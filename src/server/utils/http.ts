import type { H3Event } from 'h3'
import type { z } from 'zod'
import { DomainError, ValidationError } from '../domain/errors.ts'
import type { ApiErrorData } from '../../shared/types/booking.ts'

const STATUS_BY_CODE = {
  validation_failed: 422,
  not_found: 404,
  conflict: 409,
  invalid_transition: 409,
  internal_error: 500,
} as const

function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    ;(result[key] ??= []).push(issue.message)
  }
  return result
}

function httpError(statusMessage: string, data: ApiErrorData) {
  return createError({ statusCode: STATUS_BY_CODE[data.code], statusMessage, data })
}

function toHttpError(error: unknown) {
  if (isError(error)) return error
  if (error instanceof ValidationError) {
    return httpError(error.message, { code: error.code, fieldErrors: error.fieldErrors })
  }
  if (error instanceof DomainError) return httpError(error.message, { code: error.code })
  console.error('[api] unexpected error', error)
  return httpError('Something went wrong', { code: 'internal_error' })
}

/** Wraps a handler so domain errors become consistent HTTP errors and nothing internal leaks. */
export function defineApiHandler<T>(handler: (event: H3Event) => T | Promise<T>) {
  return defineEventHandler(async (event) => {
    try {
      return await handler(event)
    }
    catch (error) {
      throw toHttpError(error)
    }
  })
}

function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new ValidationError('The request is invalid', fieldErrorsOf(result.error))
  }
  return result.data
}

export function parseValue<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  return parse(schema, value)
}

export async function parseBody<S extends z.ZodType>(event: H3Event, schema: S): Promise<z.infer<S>> {
  return parse(schema, await readBody(event))
}

export function parseQuery<S extends z.ZodType>(event: H3Event, schema: S): z.infer<S> {
  return parse(schema, getQuery(event))
}

export function parseParam<S extends z.ZodType>(event: H3Event, name: string, schema: S): z.infer<S> {
  return parse(schema, getRouterParam(event, name))
}
