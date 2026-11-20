import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function GET() {
  const sampleRows = [
    {
      email: "juan.perez@tuempresa.com",
      full_name: "Juan Pérez",
      department: "Operaciones Viales",
      job_title: "Operador de Retroexcavadora",
      employee_code: "EMP-1001",
    },
    {
      email: "maria.gomez@tuempresa.com",
      full_name: "María Gómez",
      department: "Logística",
      job_title: "Operadora de Autoelevador",
      employee_code: "EMP-1002",
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  ws["!cols"] = [{ wch: 30 }, { wch: 24 }, { wch: 22 }, { wch: 28 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws, "Plantilla Empleados");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Plantilla-Alumnos-SolutionAcademy.xlsx"',
    },
  });
}

