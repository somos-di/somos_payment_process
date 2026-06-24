export class AppError extends Error {
  constructor(message: string, public httpStatus = 400, public code = 'app_error') {
    super(message);
  }
}
export class NotFoundError extends AppError {
  constructor(msg = 'Não encontrado') { super(msg, 404, 'not_found'); }
}
export class UnauthorizedError extends AppError {
  constructor(msg = 'Não autenticado') { super(msg, 401, 'unauthorized'); }
}
export class ValidationError extends AppError {
  constructor(msg = 'Dados inválidos') { super(msg, 400, 'validation_error'); }
}
