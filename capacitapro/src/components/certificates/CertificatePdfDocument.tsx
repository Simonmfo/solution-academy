import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: "#F8FAFC",
    fontFamily: "Helvetica",
  },
  frame: {
    flex: 1,
    borderWidth: 3,
    borderColor: "#0D5BD9",
    backgroundColor: "#FFFFFF",
    padding: 36,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 16,
  },
  brand: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#0D1B2A",
  },
  brandSub: {
    fontSize: 10,
    color: "#0D5BD9",
    marginTop: 2,
    letterSpacing: 2,
  },
  certNumber: {
    fontSize: 10,
    color: "#64748B",
  },
  body: {
    alignItems: "center",
    marginVertical: 20,
  },
  eyebrow: {
    fontSize: 11,
    color: "#0D5BD9",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  studentName: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#0D1B2A",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 14,
    textAlign: "center",
  },
  courseTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0D5BD9",
    textAlign: "center",
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 8,
  },
  metaItem: {
    fontSize: 10,
    color: "#334155",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 18,
  },
  signatureBox: {
    width: 220,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#0D1B2A",
    marginBottom: 6,
    height: 24,
  },
  signatureName: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0D1B2A",
  },
  signatureRole: {
    fontSize: 9,
    color: "#64748B",
  },
  qrBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qrImage: {
    width: 72,
    height: 72,
  },
  qrText: {
    fontSize: 8,
    color: "#475569",
    maxWidth: 170,
  },
});

export interface CertificatePdfProps {
  certificateNumber: string;
  studentName: string;
  companyName: string;
  courseTitle: string;
  instructorName: string;
  finalGrade: number | null;
  totalHours: number;
  issuedAtFormatted: string;
  verificationUrl: string;
  qrDataUrl: string;
}

export function CertificatePdfDocument(props: CertificatePdfProps) {
  return (
    <Document title={`Certificado ${props.certificateNumber} - ${props.studentName}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>CAPACITAPRO</Text>
              <Text style={styles.brandSub}>SOLUTION ACADEMY • FORMACIÓN EMPRESARIAL</Text>
            </View>
            <Text style={styles.certNumber}>N.° {props.certificateNumber}</Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.eyebrow}>CERTIFICADO DE APROBACIÓN VERIFICABLE</Text>
            <Text style={styles.subtitle}>Se otorga el presente diploma a</Text>
            <Text style={styles.studentName}>{props.studentName}</Text>
            <Text style={styles.subtitle}>
              Colaborador de {props.companyName}, por haber completado y aprobado satisfactoriamente el programa:
            </Text>
            <Text style={styles.courseTitle}>{props.courseTitle}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaItem}>Carga Horaria: {props.totalHours} horas</Text>
              {props.finalGrade !== null && (
                <Text style={styles.metaItem}>Calificación Final: {props.finalGrade}%</Text>
              )}
              <Text style={styles.metaItem}>Fecha de Emisión: {props.issuedAtFormatted}</Text>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.signatureBox}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureName}>{props.instructorName}</Text>
              <Text style={styles.signatureRole}>Dirección Académica • CapacitaPro LMS</Text>
            </View>

            <View style={styles.qrBox}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={props.qrDataUrl} style={styles.qrImage} />
              <View>
                <Text style={styles.qrText}>Escaneá el código QR para validar la autenticidad de este diploma:</Text>
                <Text style={styles.qrText}>{props.verificationUrl}</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

