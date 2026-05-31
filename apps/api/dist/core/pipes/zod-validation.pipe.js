"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZodValidationPipe = void 0;
const common_1 = require("@nestjs/common");
class ZodValidationPipe {
    schema;
    constructor(schema) {
        this.schema = schema;
    }
    transform(value, metadata) {
        try {
            return this.schema.parse(value);
        }
        catch (error) {
            const errors = error.errors?.map((err) => ({
                path: err.path.join('.'),
                message: err.message,
            })) || [];
            throw new common_1.BadRequestException({
                message: 'Validasi input gagal',
                errors,
            });
        }
    }
}
exports.ZodValidationPipe = ZodValidationPipe;
//# sourceMappingURL=zod-validation.pipe.js.map