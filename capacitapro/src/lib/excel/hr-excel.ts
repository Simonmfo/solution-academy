import * as XLSX from "xlsx";
import { employeeImportRowSchema, type EmployeeImportRow } from "@/lib/validations/schemas";

export interface ParsedImportResult {
  validRows: EmployeeImportRow[];
  errors: Array<{ row: number; message: string }>;
}

/**
 * Parsea un archivo Excel (.xlsx) o CSV subido por RRHH para alta masiva de empleados.
 * Columnas soportadas: email, full_name (o nombre), department (o area), job_title (o puesto), employee_code (o legajo)
 */
export function parseEmployeesSpreadsheet(buffer: ArrayBuffer): ParsedImportResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { validRows: [], errors: [{ row: 0, message: "El archivo no contiene hojas válidas." }] };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const validRows: EmployeeImportRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  rawRows.forEach((row, index) => {
    const normalized = {
      email: String(row.email ?? row.Email ?? row.correo ?? row.Correo ?? "").trim().toLowerCase(),
      full_name: String(
        row.full_name ?? row.nombre ?? row.Nombre ?? row["Nombre Completo"] ?? ""
      ).trim(),
      department: String(row.department ?? row.departamento ?? row.area ?? row.Area ?? "General").trim(),
      job_title: String(row.job_title ?? row.puesto ?? row.cargo ?? "Colaborador").trim(),
      employee_code: String(row.employee_code ?? row.legajo ?? row.codigo ?? "").trim() || undefined,
    };

    const parsed = employeeImportRowSchema.safeParse(normalized);
    if (!parsed.success) {
      errors.push({
        row: index + 2,
        message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | "),
      });
    } else {
      validRows.push(parsed.data);
    }
  });

  return { validRows, errors };
}

export interface HrReportRow {
  empleado: string;
  email: string;
  legajo: string;
  departamento: string;
  curso: string;
  obligatorio: string;
  estado: string;
  progreso_pct: number;
  nota_final: number | string;
  fecha_limite: string;
  fecha_completado: string;
}

/**
 * Genera un buffer .xlsx con dos hojas: Resumen Ejecutivo + Detalle de Avance por Empleado
 */
export function generateHrReportWorkbook(
  companyName: string,
  summary: Record<string, string | number>,
  rows: HrReportRow[]
): Buffer {
  const workbook = XLSX.utils.book_new();

  const summaryRows = Object.entries(summary).map(([Indicador, Valor]) => ({
    Empresa: companyName,
    Indicador,
    Valor,
  }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 28 }, { wch: 32 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen RRHH");

  const detailSheet = XLSX.utils.json_to_sheet(rows);
  detailSheet["!cols"] = [
    { wch: 26 },
    { wch: 30 },
    { wch: 14 },
    { wch: 20 },
    { wch: 36 },
    { wch: 13 },
    { wch: 15 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(workbook, detailSheet, "Avance Empleados");

  const arrayBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return arrayBuffer;
}

