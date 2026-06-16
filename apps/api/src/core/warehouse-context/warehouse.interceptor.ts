import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { WarehouseContextService } from './warehouse-context.service';

@Injectable()
export class WarehouseInterceptor implements NestInterceptor {
  constructor(
    private readonly warehouseContextService: WarehouseContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const warehouse = request.warehouse;

    const warehouseId = warehouse?.id;
    const warehouseUuid = warehouse?.uuid;
    const userId = user?.id;

    return new Observable((subscriber) => {
      this.warehouseContextService.run(
        { warehouseId, warehouseUuid, userId },
        () => {
          const subscription = next.handle().subscribe({
            next: (val) => subscriber.next(val),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
          return () => subscription.unsubscribe();
        },
      );
    });
  }
}
