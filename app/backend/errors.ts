
export class AppError extends Error {
  constructor(message: string, public httpStatus = 400, public code = 'app_error') {
    super(message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = 'Não encontrado') { super(message, 404, 'not_found'); }
}
export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado') { super(message, 401, 'unauthorized'); }
}
export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos') { super(message, 400, 'validation_error'); }
}
