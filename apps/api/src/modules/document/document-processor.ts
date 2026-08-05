import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PDFDocument } from 'pdf-lib';
import PizZip = require('pizzip');
import Docxtemplater = require('docxtemplater');
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

@Processor('document-generation')
export class DocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  /**
   * Helper to run LibreOffice headless conversion
   */
  private async convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
    const tempDir = path.join(process.cwd(), 'temp-doc-gen');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const uniqueId = crypto.randomUUID();
    const tempDocxPath = path.join(tempDir, `${uniqueId}.docx`);
    const tempPdfPath = path.join(tempDir, `${uniqueId}.pdf`);

    // Write DOCX buffer to temp file
    fs.writeFileSync(tempDocxPath, docxBuffer);

    // Get LibreOffice path (defaulting to standard Windows installation)
    const sofficePath = process.env.LIBREOFFICE_PATH || 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';

    try {
      this.logger.log(`Converting DOCX to PDF using LibreOffice: ${sofficePath}`);
      
      // Execute soffice conversion
      const cmd = `"${sofficePath}" --headless --convert-to pdf --outdir "${tempDir}" "${tempDocxPath}"`;
      await execAsync(cmd);

      if (!fs.existsSync(tempPdfPath)) {
        throw new Error('LibreOffice did not generate the PDF file.');
      }

      // Read PDF buffer
      const pdfBuffer = fs.readFileSync(tempPdfPath);
      return pdfBuffer;
    } catch (error: any) {
      this.logger.error(`LibreOffice conversion failed: ${error.message}`);
      throw error;
    } finally {
      // Clean up temp files
      try {
        if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath);
        if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
      } catch (e) {
        this.logger.warn(`Failed to clean up temp files: ${e}`);
      }
    }
  }

  /**
   * Helper to merge multiple PDF buffers
   */
  private async mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
    if (buffers.length === 0) {
      throw new Error('No PDF buffers to merge.');
    }
    if (buffers.length === 1) {
      return buffers[0];
    }

    const mergedPdf = await PDFDocument.create();
    for (const buffer of buffers) {
      const pdf = await PDFDocument.load(buffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }
    return Buffer.from(await mergedPdf.save());
  }

  /**
   * Helper to compile a DOCX template using docxtemplater
   */
  private compileDocx(templateBuffer: Buffer, data: any): Buffer {
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    doc.render(data);
    return doc.getZip().generate({ type: 'nodebuffer' });
  }

  /**
   * BullMQ queue job worker process
   */
  async process(job: Job<any, any, string>): Promise<any> {
    const { id, templateId, placeholder, attachments, userId, warehouseId } = job.data;
    this.logger.log(`Processing document generation job for ID: ${id}`);

    // Update status to PROCESSING (redundant but safe)
    await this.prisma.documentGenerated.update({
      where: { id },
      data: { status: 'PROCESSING' },
    });

    try {
      // 1. Load Main Template
      const template = await this.prisma.documentTemplate.findUnique({
        where: { id: templateId },
      });
      if (!template) {
        throw new Error(`Template with ID ${templateId} not found.`);
      }

      // Download Main Template DOCX
      this.logger.log(`Downloading template DOCX from MinIO: ${template.objectKey}`);
      const mainTemplateBuffer = await this.storageService.getFileBuffer(template.objectKey);

      // Compile Main Template
      this.logger.log('Compiling main template DOCX...');
      const mainDocxBuffer = this.compileDocx(mainTemplateBuffer, placeholder);

      // Convert Main DOCX to PDF
      this.logger.log('Converting main DOCX to PDF...');
      const mainPdfBuffer = await this.convertDocxToPdf(mainDocxBuffer);

      // 2. Process Document Assembly
      const assemblySchema = (template.assemblySchema as any[]) || [];
      const pdfBuffersToMerge: Buffer[] = [mainPdfBuffer];

      // We will separate sections into: before specific templates, after specific templates, and end of document
      const sectionTemplates = assemblySchema.filter((item) => item.type === 'TEMPLATE');
      const pdfAttachments = assemblySchema.filter((item) => item.type === 'PDF');
      let userUploadIndex = 0;

      // Helper to evaluate assembly conditions (simple evaluation of placeholder values)
      const evaluateCondition = (conditionStr?: string | null): boolean => {
        if (!conditionStr) return true;
        try {
          // Condition format e.g. "HAS_BA == true" or "someVar == 'value'"
          // We can construct a simple safe JS expression evaluator using placeholder keys
          const keys = Object.keys(placeholder);
          const values = Object.values(placeholder);
          const fn = new Function(...keys, `return ${conditionStr};`);
          return fn(...values);
        } catch (e) {
          this.logger.warn(`Failed to evaluate condition "${conditionStr}": ${e}`);
          return false; // Fail safe
        }
      };

      // Generate section PDFs and merge them
      for (const section of sectionTemplates) {
        if (!evaluateCondition(section.condition)) {
          this.logger.log(`Skipping section template "${section.templateCode}" due to unsatisfied condition.`);
          continue;
        }

        // Find the section template
        const secTemplate = await this.prisma.documentTemplate.findFirst({
          where: { code: section.templateCode, deletedAt: null },
        });
        if (!secTemplate) {
          this.logger.warn(`Section template with code "${section.templateCode}" not found.`);
          continue;
        }

        // Check if there are attachments placed before this section
        const beforeSectionAttachments = pdfAttachments.filter(
          (att) => att.position === 'BEFORE_SECTION' && att.templateCode === section.templateCode
        );
        for (const att of beforeSectionAttachments) {
          let key = att.source || att.objectKey;
          if (key === 'USER_UPLOAD') {
            key = attachments[userUploadIndex]?.objectKey;
            userUploadIndex++;
          }
          if (key) {
            this.logger.log(`Downloading assembly attachment (before section): ${key}`);
            const attBuffer = await this.storageService.getFileBuffer(key);
            pdfBuffersToMerge.push(attBuffer);
          }
        }

        // Process section template
        const secBuffer = await this.storageService.getFileBuffer(secTemplate.objectKey);
        const compiledSecDocx = this.compileDocx(secBuffer, placeholder);
        const compiledSecPdf = await this.convertDocxToPdf(compiledSecDocx);
        pdfBuffersToMerge.push(compiledSecPdf);

        // Check if there are attachments placed after this section
        const afterSectionAttachments = pdfAttachments.filter(
          (att) => att.position === 'AFTER_SECTION' && att.templateCode === section.templateCode
        );
        for (const att of afterSectionAttachments) {
          let key = att.source || att.objectKey;
          if (key === 'USER_UPLOAD') {
            key = attachments[userUploadIndex]?.objectKey;
            userUploadIndex++;
          }
          if (key) {
            this.logger.log(`Downloading assembly attachment (after section): ${key}`);
            const attBuffer = await this.storageService.getFileBuffer(key);
            pdfBuffersToMerge.push(attBuffer);
          }
        }
      }

      // Process global AFTER_DOCUMENT / LAST_PAGE PDF attachments in assembly
      const afterDocAttachments = pdfAttachments.filter(
        (att) => att.position === 'AFTER_DOCUMENT' || att.position === 'LAST_PAGE' || !att.position
      );
      for (const att of afterDocAttachments) {
        let key = att.source || att.objectKey;
        if (key === 'USER_UPLOAD') {
          key = attachments[userUploadIndex]?.objectKey;
          userUploadIndex++;
        }
        if (key) {
          this.logger.log(`Downloading assembly attachment (end of document): ${key}`);
          const attBuffer = await this.storageService.getFileBuffer(key);
          pdfBuffersToMerge.push(attBuffer);
        }
      }

      // Process user uploaded attachments or explicit job attachments (only those that were not consumed by USER_UPLOAD slots in assembly)
      const remainingAttachments = attachments.slice(userUploadIndex);
      for (const att of remainingAttachments) {
        if (att.objectKey) {
          this.logger.log(`Downloading job attachment: ${att.objectKey}`);
          const attBuffer = await this.storageService.getFileBuffer(att.objectKey);
          pdfBuffersToMerge.push(attBuffer);
        }
      }

      // 3. Merge all into Final PDF
      this.logger.log('Merging all section and attachment PDFs...');
      const finalPdfBuffer = await this.mergePdfBuffers(pdfBuffersToMerge);

      // 4. Upload Files to MinIO
      const docxPath = `generated/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.docx`;
      const pdfPath = `generated/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.pdf`;

      this.logger.log(`Uploading compiled DOCX to MinIO: ${docxPath}`);
      await this.storageService.uploadBuffer(mainDocxBuffer, docxPath, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

      this.logger.log(`Uploading final merged PDF to MinIO: ${pdfPath}`);
      await this.storageService.uploadBuffer(finalPdfBuffer, pdfPath, 'application/pdf');

      // Compute Hash of final PDF
      const hash = crypto.createHash('sha256').update(finalPdfBuffer).digest('hex');

      // 5. Update Database Record
      await this.prisma.documentGenerated.update({
        where: { id },
        data: {
          docxObjectKey: docxPath,
          pdfObjectKey: pdfPath,
          fileHash: hash,
          status: 'GENERATED',
        },
      });

      this.logger.log(`Document generation job completed successfully for ID: ${id}`);
    } catch (error: any) {
      this.logger.error(`Document generation job failed for ID: ${id}: ${error.message}`, error.stack);
      
      // Update status to FAILED
      await this.prisma.documentGenerated.update({
        where: { id },
        data: {
          status: 'FAILED',
          errorMessage: error.message || 'Internal processing error',
        },
      });

      throw error;
    }
  }
}
