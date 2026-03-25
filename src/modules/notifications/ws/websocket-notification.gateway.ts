import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ValidOpportunityDetectedEvent } from '../../thorchain/events/thorchain.events';
import { StreamSwapOpportunity } from '../../thorchain/interfaces/thorchain.interface';
import { getErrorMessage } from 'src/common/utils/error-message.utils';

interface OpportunityEventPayload {
  type: 'opportunity.detected';
  timestamp: string;
  opportunity: StreamSwapOpportunity;
  address: string;
}

@WebSocketGateway({
  path: '/ws',
  transports: ['websocket'],
})
@Injectable()
export class WebSocketNotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketNotificationGateway.name);
  private connectedClients: Set<WebSocket> = new Set();

  /**
   * Handle new WebSocket client connection
   */
  handleConnection(client: WebSocket): void {
    this.connectedClients.add(client);
    const clientCount = this.connectedClients.size;
    this.logger.log(
      `WebSocket client connected. Total clients: ${clientCount}`,
    );

    // Send welcome message
    this.sendToClient(client, {
      type: 'connection.established',
      timestamp: new Date().toISOString(),
      message: 'Connected to opportunity notification service',
    });
  }

  /**
   * Handle WebSocket client disconnection
   */
  handleDisconnect(client: WebSocket): void {
    this.connectedClients.delete(client);
    const clientCount = this.connectedClients.size;
    this.logger.log(
      `WebSocket client disconnected. Total clients: ${clientCount}`,
    );
  }

  /**
   * Listen for valid opportunity detected events and broadcast to all clients
   */
  @OnEvent('validopportunity.detected', { async: true })
  async handleValidOpportunityDetected(
    event: ValidOpportunityDetectedEvent,
  ): Promise<void> {
    // satisfy `require-await` without changing behavior
    await Promise.resolve();

    try {
      const { opportunity, address } = event;

      this.logger.debug(
        `Broadcasting opportunity event to ${this.connectedClients.size} clients: ${opportunity.txHash}`,
      );

      const payload: OpportunityEventPayload = {
        type: 'opportunity.detected',
        timestamp: new Date().toISOString(),
        opportunity,
        address,
      };

      this.broadcast(payload);
    } catch (error: unknown) {
      // Don't crash on broadcast failures - just log the error
      this.logger.error(
        `Error broadcasting opportunity event: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(payload: OpportunityEventPayload): void {
    const message = JSON.stringify(payload);
    let successCount = 0;
    let errorCount = 0;

    this.connectedClients.forEach((client) => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
          successCount++;
        } else {
          // Remove stale connections
          this.connectedClients.delete(client);
          errorCount++;
        }
      } catch (error: unknown) {
        this.logger.warn(
          `Failed to send message to client: ${getErrorMessage(error)}`,
        );
        this.connectedClients.delete(client);
        errorCount++;
      }
    });

    if (successCount > 0) {
      this.logger.debug(
        `Broadcasted to ${successCount} client(s)${errorCount > 0 ? `, removed ${errorCount} stale connection(s)` : ''}`,
      );
    }
  }

  /**
   * Send message to a specific client
   */
  private sendToClient(client: WebSocket, payload: any): void {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to send message to client: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Get number of connected clients
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
}
