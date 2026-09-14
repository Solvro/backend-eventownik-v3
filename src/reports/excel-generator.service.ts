import * as ExcelJS from "exceljs";

import { Injectable } from "@nestjs/common";

export interface ReportRow {
  index: number;
  eventName: string;
  organizerName: string;
  endDate: Date;
  attributesStr: string;
}

@Injectable()
export class ExcelGeneratorService {
  async generateBbiReport(rows: ReportRow[]): Promise<Buffer> {
    const date = new Date();
    const monthNames = [
      "styczeń",
      "luty",
      "marzec",
      "kwiecień",
      "maj",
      "czerwiec",
      "lipiec",
      "sierpień",
      "wrzesień",
      "październik",
      "listopad",
      "grudzień",
    ];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Solvro";
    workbook.title = `RCP PWR Eventownik Solvro ${monthNames[date.getMonth()]} ${date.getFullYear().toString()}`;
    const sheet = workbook.addWorksheet("RCP");

    sheet.columns = [
      { header: "lp", key: "lp", width: 5 },
      { header: "Nazwa wydarzenia", key: "eventName", width: 25 },
      {
        header: "Nazwa czynności przetwarzania",
        key: "activityName",
        width: 35,
      },
      {
        header: "Jednostka organizacyjna (departament, dział itp.)",
        key: "department",
        width: 30,
      },
      { header: "Cel przetwarzania", key: "purpose", width: 40 },
      { header: "Kategorie osób", key: "categories", width: 45 },
      { header: "-", key: "attributes", width: 50 },
      { header: "Podstawa prawna", key: "legalBasis", width: 45 },
      { header: "Źródło danych", key: "dataSource", width: 35 },
      {
        header:
          "Planowany termin usunięcia kategorii danych (jeżeli jest to możliwe)",
        key: "deletionDate",
        width: 45,
      },
      {
        header: "Nazwa współadministratora i dane kontaktowe (jeśli dotyczy)",
        key: "coAdmin",
        width: 35,
      },
      {
        header:
          "Nazwa podmiotu przetwarzajacego i dane kontakowe (jeśli dotyczy)",
        key: "processor",
        width: 45,
      },
      {
        header: "Kategorie odbiorców (innych niż podmiot przetwarzajacy)",
        key: "recipients",
        width: 45,
      },
      {
        header: "Nazwa systemu lub oprogramowania",
        key: "systemName",
        width: 25,
      },
      {
        header:
          "Ogólny opis technicznych i organizacyjnych srodków bezpieczeństwa zgodnie z art. 32 ust. 1 (jeżeli jest to możliwe)",
        key: "security",
        width: 55,
      },
      {
        header: "DPIA (od strony użytkownika)",
        key: "dpiaUser",
        width: 25,
      },
      {
        header: "DPIA (od strony systemu)",
        key: "dpiaSystem",
        width: 25,
      },
      {
        header:
          "Transfer do kraju trzeciego lub organizacji międzynarodowej (nazwa kraju i podmiotu)",
        key: "transfer",
        width: 30,
      },
      {
        header:
          "Jeśli transfer i art. 49 ust. 1 akapit drugi - dokumentacja odpowiednich zabezpieczeń",
        key: "transferDocs",
        width: 30,
      },
    ];

    for (const row of rows) {
      const deletionDateString = `${String(row.endDate.getDate()).padStart(2, "0")}.${String(row.endDate.getMonth() + 1).padStart(2, "0")}.${String(row.endDate.getFullYear() + 1)}`;

      sheet.addRow({
        lp: row.index,
        eventName: row.eventName,
        activityName:
          "Rejestracja osób i obsługa wydarzeń w aplikacji Eventownik",
        department: "Dział Informatyzacji",
        purpose:
          "Umożliwienie użytkownikom rejestracji na wydarzenia organizowane przez organizacje na Politechnice Wrocławskiej oraz zarządzanie listą uczestników i kontakt organizatorów z uczestnikami",
        categories: `1. Organizator - ${row.organizerName}\n2. Uczestnicy wydarzenia ${row.eventName}\n3. Administratorzy serwisu - KN Solvro`,
        attributes: row.attributesStr,
        legalBasis:
          "Art. 6 ust. 1 lit. a RODO – zgoda osoby, której dane dotyczą",
        dataSource: "Bezpośrednio od osoby, podczas rejestracji na stronie",
        deletionDate: `Dane uczestników będą przechowywane przez okres realizacji wydarzenia do ${deletionDateString}.\nDane organizatorów będą przechowywane przez 5 lat od utworzenia konta.`,
        coAdmin: "brak",
        processor:
          "Politechnika Wrocławska\nE-mail: eventownik@pwr.edu.pl\nAdres: ul. Zygmunta Wróblewskiego 27\n51-627 Wrocław\nNIP: 8960005851\nREGON: 000001614",
        recipients: `Administrator serwisu (KN Solvro),\nOrganizator wydarzenia - ${row.organizerName}`,
        systemName: "Eventownik Solvro",
        security:
          "Hostowanie rozwiązania na serwerach Politechniki, ograniczenie czasu sesji użytkownika, zastosowanie hashy autoryzacyjnych, zastosowanie uprawnień administratorów, przygotowanie regulaminów serwisu",
        dpiaUser: {
          text: "Raport - Użytkownik",
          hyperlink:
            "https://docs.google.com/spreadsheets/d/1OkB_j8biS_WrEHEEDu7S73lj1giEzJ_i",
        },
        dpiaSystem: {
          text: "Raport - System",
          hyperlink:
            "https://docs.google.com/spreadsheets/d/1TXR06rI5kHVkiTV1ABWAIKteLSVzSxcSRzIjfYV2zaw/edit?gid=1415039930#gid=1415039930",
        },
        transfer: "nie dotyczy",
        transferDocs: "nie dotyczy",
      });
    }

    // Formatowanie arkusza
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = {
        name: "Calibri",
        size: 8,
        color: { argb: "FFFFFFFF" },
        bold: true,
        italic: true,
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };

      const grayColumns = [
        "lp",
        "Nazwa wydarzenia",
        "Nazwa czynności przetwarzania",
        "Jednostka organizacyjna (departament, dział itp.)",
        "Podstawa prawna",
        "Źródło danych",
        "Nazwa systemu lub oprogramowania",
        "DPIA (od strony użytkownika)",
        "DPIA (od strony systemu)",
      ];

      let headerText = "";
      if (typeof cell.value === "string") {
        headerText = cell.value;
      }

      const isGray =
        headerText === "" ? false : grayColumns.includes(headerText);
      const bgColor = isGray ? "FF404040" : "FFB32424";
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: bgColor },
      };
    });

    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        if (rowNumber > 1) {
          cell.alignment = { wrapText: true, vertical: "top" };
          cell.font = { name: "Calibri", size: 8 };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }
}
