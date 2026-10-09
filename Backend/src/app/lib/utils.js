// src/lib/utils.js

import { NextResponse } from "next/server";

import corsHeaders from "./cors";

const ERROR_CODES = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  500: "INTERNAL_ERROR",
};

export function printExceptionLog(logMessage, error) {
  console.log(`==>${logMessage} Exception`);
  console.log(error);
}

export function errorResponse(message, status, code = ERROR_CODES[status] ?? "ERROR") {
  return NextResponse.json({ error: { code, message } }, { status, headers: corsHeaders });
}

export function successResponse(jsonData, status) {
  return NextResponse.json(jsonData, {
    status: status,
    headers: corsHeaders,
  });
}
