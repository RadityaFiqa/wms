import { Controller, Get, Param, Req } from '@nestjs/common';
import { SignedDocumentService } from './signed-document.service';

@Controller('document-verification')
export class DocumentVerificationController {
  constructor(private readonly service: SignedDocumentService) {}

  @Get(':token')
  async verify(@Param('token') token: string, @Req() req: any) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.service.verifyToken(token, ipAddress, userAgent);
  }
}
