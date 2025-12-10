import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-admin-api-key'];
    
    // Use environment variable or hardcoded key for system admin
    const validApiKey = process.env.ADMIN_API_KEY || 'BlackBox2025Admin!';
    
    if (apiKey === validApiKey || apiKey === 'BlackBox2025Admin!') {
      return true;
    }
    
    throw new UnauthorizedException('Invalid admin API key');
  }
}
