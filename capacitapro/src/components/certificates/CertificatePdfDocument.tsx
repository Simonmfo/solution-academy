import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { isMainAcademyOrganization } from "@/lib/solution-academy";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    backgroundColor: "#F1F5F9",
    fontFamily: "Helvetica",
  },
  outerFrame: {
    flex: 1,
    borderWidth: 3,
    borderColor: "#0D1B2A",
    backgroundColor: "#FFFFFF",
    padding: 8,
  },
  innerFrame: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#0D5BD9",
    padding: 30,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 14,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: 6,
  },
  brandBlock: {
    flexDirection: "column",
  },
  brand: {
    fontSize: 21,
    fontWeight: "bold",
    color: "#0D1B2A",
    letterSpacing: 1.4,
  },
  brandSub: {
    fontSize: 8.5,
    color: "#0D5BD9",
    marginTop: 3,
    letterSpacing: 2.0,
  },
  sealBox: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#0D5BD9",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "flex-end",
  },
  sealLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#0D5BD9",
    letterSpacing: 1.2,
  },
  certNumber: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0D1B2A",
    marginTop: 2,
  },
  body: {
    alignItems: "center",
    marginVertical: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0D5BD9",
    letterSpacing: 3.2,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 10,
    textAlign: "center",
  },
  studentName: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#0D1B2A",
    marginBottom: 10,
    textAlign: "center",
  },
  divider: {
    width: 140,
    height: 2,
    backgroundColor: "#0D5BD9",
    marginBottom: 14,
  },
  courseTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0D5BD9",
    textAlign: "center",
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  metaRow: {
    flexDirection: "row",
    gap: 18,
    marginTop: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  metaItem: {
    fontSize: 10,
    color: "#1E293B",
    fontWeight: "bold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 16,
  },
  signatureBox: {
    width: 250,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#0D1B2A",
    marginBottom: 6,
    height: 22,
  },
  signatureName: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0D1B2A",
  },
  signatureRole: {
    fontSize: 9,
    color: "#64748B",
    marginTop: 2,
  },
  qrBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    padding: 8,
  },
  qrImage: {
    width: 74,
    height: 74,
  },
  qrTextBlock: {
    maxWidth: 185,
  },
  qrTitle: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#0D1B2A",
    marginBottom: 3,
  },
  qrText: {
    fontSize: 7.5,
    color: "#475569",
    lineHeight: 1.35,
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
  logoDataUrl?: string | null;
}

export function CertificatePdfDocument(props: CertificatePdfProps) {
  const showAgreementPrefix =
    Boolean(props.companyName) && !isMainAcademyOrganization(props.companyName);

  return (
    <Document
      title={`Certificado Solution Academy ${props.certificateNumber} - ${props.studentName}`}
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.outerFrame}>
          <View style={styles.innerFrame}>
            <View style={styles.header}>
              <View style={styles.brandRow}>
                {props.logoDataUrl ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image src={props.logoDataUrl} style={styles.logoImage} />
                ) : null}
                <View style={styles.brandBlock}>
                  <Text style={styles.brand}>SOLUTION ACADEMY</Text>
                  <Text style={styles.brandSub}>CAPACITAMOS • INSPIRAMOS • TRANSFORMAMOS</Text>
                </View>
              </View>
              <View style={styles.sealBox}>
                <Text style={styles.sealLabel}>CERTIFICADO OFICIAL</Text>
                <Text style={styles.certNumber}>N.° {props.certificateNumber}</Text>
              </View>
            </View>

            <View style={styles.body}>
              <Text style={styles.eyebrow}>DIPLOMA DE FORMACIÓN TÉCNICA</Text>
              <Text style={styles.subtitle}>Solution Academy certifica por la presente que</Text>
              <Text style={styles.studentName}>{props.studentName}</Text>
              <View style={styles.divider} />
              <Text style={styles.subtitle}>
                {showAgreementPrefix
                  ? `En el marco del convenio con ${props.companyName}, completó y aprobó satisfactoriamente el programa:`
                  : "completó y aprobó satisfactoriamente el programa de capacitación técnica:"}
              </Text>
              <Text style={styles.courseTitle}>{props.courseTitle}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaItem}>Carga Horaria: {props.totalHours} horas</Text>
                {props.finalGrade !== null && (
                  <Text style={styles.metaItem}>Calificación Final: {props.finalGrade}%</Text>
                )}
                <Text style={styles.metaItem}>Emisión: {props.issuedAtFormatted}</Text>
              </View>
            </View>

            <View style={styles.footer}>
              <View style={styles.signatureBox}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureName}>{props.instructorName}</Text>
                <Text style={styles.signatureRole}>Dirección Académica • Solution Academy</Text>
              </View>

              <View style={styles.qrBox}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={props.qrDataUrl} style={styles.qrImage} />
                <View style={styles.qrTextBlock}>
                  <Text style={styles.qrTitle}>Validación Pública Oficial</Text>
                  <Text style={styles.qrText}>
                    Escaneá este código QR o ingresá al enlace para comprobar autenticidad y vigencia:
                  </Text>
                  <Text style={styles.qrText}>{props.verificationUrl}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
