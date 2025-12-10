import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';
import { ChatMessageDto } from './dto/chat-message.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not found in environment variables. AI features will be disabled.');
    } else {
      this.logger.log(`OpenAI API initialized successfully (key length: ${apiKey.length})`);
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey || 'dummy-key', // Use dummy key if not set to prevent crashes
    });
  }

  async chat(chatMessageDto: ChatMessageDto, tenantId?: string): Promise<{ response: string }> {
    try {
      const { message, context } = chatMessageDto;

      // Fetch training scripts
      let globalScript = '';
      let partnerScript = '';

      // 1. Get Global Admin Script
      const globalConfig = await this.prisma.platformConfig.findUnique({
        where: { key: 'GLOBAL_AI_SCRIPT' },
      });
      if (globalConfig?.value) {
        globalScript = (globalConfig.value as any).script || '';
      }

      // 2. Get Partner Script if tenant is associated with a partner
      if (tenantId) {
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { subdomain: true, name: true },
        });

        if (tenant) {
          // Try to find a partner matching the tenant's subdomain or name
          // This is a heuristic since we don't have a direct link yet
          const partner = await this.prisma.partner.findFirst({
            where: {
              OR: [
                { name: { equals: tenant.name, mode: 'insensitive' } },
                { name: { equals: tenant.subdomain, mode: 'insensitive' } },
              ],
            },
          });

          if (partner && (partner as any).aiScript) {
            partnerScript = (partner as any).aiScript;
          }
        }
      }

      // Build system message based on context and scripts
      const systemMessage = this.buildSystemMessage(context, globalScript, partnerScript);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

      return { response };
    } catch (error) {
      this.logger.error('Error calling OpenAI API:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error('AI service is not properly configured. Please contact support.');
        }
      }
      
      throw new Error('Failed to get AI response. Please try again.');
    }
  }

  private buildSystemMessage(
    context?: ChatMessageDto['context'], 
    globalScript?: string, 
    partnerScript?: string
  ): string {
    let systemMessage = `You are a helpful AI assistant for an e-commerce page builder platform called Saa'ah. 
Your role is to help users:
1. Understand how to use the page builder
2. Create engaging content for their pages
3. Troubleshoot issues
4. Learn about available features

Be concise, friendly, and practical. Provide actionable advice.`;

    // Append Global Admin Script
    if (globalScript) {
      systemMessage += `\n\n[SYSTEM INSTRUCTIONS]\n${globalScript}`;
    }

    // Append Partner Script
    if (partnerScript) {
      systemMessage += `\n\n[PARTNER SPECIFIC INSTRUCTIONS]\n${partnerScript}`;
    }

    if (context?.currentPage) {
      systemMessage += `\n\nThe user is currently editing a page titled: "${context.currentPage}"`;
    }

    if (context?.currentSection) {
      systemMessage += `\n\nThey are working on a "${context.currentSection}" section.`;
    }

    if (context?.userAction) {
      systemMessage += `\n\nThey are trying to: ${context.userAction}`;
    }

    return systemMessage;
  }

  async getSuggestions(sectionType: string): Promise<{ suggestions: string[] }> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a content strategist helping create engaging website content. Provide 3 brief, actionable suggestions.'
          },
          {
            role: 'user',
            content: `Give me 3 content suggestions for a "${sectionType}" section on an e-commerce website. Keep each suggestion under 15 words.`
          }
        ],
        temperature: 0.8,
        max_tokens: 200,
      });

      const response = completion.choices[0]?.message?.content || '';
      const suggestions = response
        .split('\n')
        .filter((line: string) => line.trim().length > 0)
        .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
        .slice(0, 3);

      return { suggestions };
    } catch (error) {
      this.logger.error('Error getting suggestions:', error);
      return { suggestions: [] };
    }
  }
}
