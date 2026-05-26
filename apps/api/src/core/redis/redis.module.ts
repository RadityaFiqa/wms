import { Global, Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { createClient } from 'redis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: async () => {
        const client = createClient({
          url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
        });
        await client.connect();
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: any) {}

  async onModuleDestroy() {
    if (this.redisClient && typeof this.redisClient.disconnect === 'function') {
      try {
        await this.redisClient.disconnect();
      } catch (err) {
        console.error('Failed to disconnect Redis client on module destroy:', err);
      }
    }
  }
}
