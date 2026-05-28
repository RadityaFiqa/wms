import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from './storage.service';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('File tidak ditemukan.');
    }

    // Limit to 5MB
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('Ukuran file tidak boleh melebihi 5MB.');
    }

    // Allowed mime types
    const allowedMimeTypes = [
      'image/png',
      'image/jpg',
      'image/jpeg',
      'application/pdf',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Format file tidak didukung. Hanya file PNG, JPG, JPEG, dan PDF yang diperbolehkan.',
      );
    }

    // Determine target folder
    const folder = file.mimetype.startsWith('image/') ? 'images' : 'attachments';
    const uploadedById = req.user?.id;
    if (!uploadedById) {
      throw new BadRequestException('Identitas user pengunggah tidak valid.');
    }

    const attachment = await this.storageService.uploadFile(file, folder, uploadedById);
    const url = this.storageService.getFilePublicUrl(attachment.filePath);

    return {
      ...attachment,
      url,
    };
  }
}
