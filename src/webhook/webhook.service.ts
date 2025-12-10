import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhookService {
  constructor(
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async dispatch(event: string, payload: any, tenantId: string) {
    // Fetch active endpoints for this tenant that subscribe to the event
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        tenantId,
        isActive: true,
        events: { has: event },
      },
    });

    const results = [];
    for (const endpoint of endpoints) {
      try {
        // Create delivery record
        const delivery = await this.prisma.webhookDelivery.create({
          data: {
            endpointId: endpoint.id,
            event,
            payload: payload as any,
            attempts: 1,
          },
        });

        // Send request
        const response = await this.http.post(endpoint.url, {
          id: delivery.id,
          event,
          createdAt: new Date().toISOString(),
          payload,
        }, {
          headers: {
            'X-Webhook-Secret': endpoint.secret,
          },
          timeout: 5000,
        }).toPromise();

        // Update delivery status
        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            responseCode: response,
            responseBody: JSON.stringify(response),
            deliveredAt: new Date(),
          },
        });
        results.push({ endpointId: endpoint.id, success: true });
      } catch (error) {
        // Log failure
        console.error(`Webhook failed for ${endpoint.url}:`, error);
        results.push({ endpointId: endpoint.id, success: false, error: error });
      }
    }
    return results;
  }
}
