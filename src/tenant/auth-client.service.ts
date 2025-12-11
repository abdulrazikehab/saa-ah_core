import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthClientService {
  private readonly logger = new Logger(AuthClientService.name);
  private readonly authServiceUrl: string;

  constructor(private configService: ConfigService) {
    this.authServiceUrl = this.configService.get('AUTH_SERVICE_URL') || 'http://localhost:3001';
  }

  async checkCanCreateMarket(userId: string, accessToken: string): Promise<{ allowed: boolean; currentCount: number; limit: number }> {
    try {
      const response = await fetch(`${this.authServiceUrl}/auth/markets/can-create`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Auth service returned ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Failed to check market limit for user ${userId}:`, error);
      throw error;
    }
  }

  async linkUserToTenant(userId: string, tenantId: string, accessToken: string): Promise<void> {
    try {
      const response = await fetch(`${this.authServiceUrl}/auth/markets/link`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, tenantId }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to link user to tenant: ${error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to link user ${userId} to tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async createTenantAndLink(userId: string, tenantData: { id: string; name: string; subdomain: string; plan?: string; status?: string }, accessToken: string): Promise<any> {
    try {
      const response = await fetch(`${this.authServiceUrl}/auth/markets/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tenantData),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create tenant and link: ${error}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Failed to create tenant and link for user ${userId}:`, error);
      throw error;
    }
  }
}

