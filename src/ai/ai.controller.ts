import { Controller, Post, Body, UseGuards, Query, Request } from '@nestjs/common';
import { AiService } from './ai.service';
import { ChatMessageDto } from './dto/chat-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../types/request.types';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(
    @Request() req: AuthenticatedRequest,
    @Body() chatMessageDto: ChatMessageDto
  ) {
    return this.aiService.chat(chatMessageDto, req.tenantId);
  }

  @Post('suggestions')
  async getSuggestions(@Query('sectionType') sectionType: string) {
    return this.aiService.getSuggestions(sectionType);
  }
}
