import { PORTFOLIO_VERSION } from "@/lib/portfolio/types";

/**
 * TEST FIXTURE ONLY. An invented portfolio for the unit tests: every company
 * and director is fictional, and the CINs and DINs follow the real formats but
 * belong to no one. Nothing in the app imports this file (a test checks), so
 * it never reaches a user's browser or storage.
 */

const NOW = "2026-01-01T00:00:00.000Z";

function client(
  id,
  name,
  cin,
  type,
  incorporatedOn,
  registeredOffice,
  status = "active",
  lastAgmOn = null,
  extras = {},
) {
  return {
    id,
    name,
    cin,
    type,
    incorporatedOn,
    registeredOffice,
    status,
    lastAgmOn,
    listed: false,
    workingFyEndingYear: null,
    paidUpCapital: 0,
    turnover: 0,
    netWorth: 0,
    netProfit: 0,
    borrowings: 0,
    deposits: 0,
    llpContribution: 0,
    directorsCount: 0,
    msmeDuesOver45Days: false,
    securitiesInDemat: false,
    auditorAppointedAtAgmFy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...extras,
  };
}

export const SEED_CLIENTS = [
  client(
    "cl-meridian",
    "Meridian Analytics Private Limited",
    "U62099KA2019PTC128740",
    "private",
    "2019-07-18",
    "No. 4, Ashwin Chambers, Residency Road, Bengaluru 560025",
    "active",
    "2025-09-26",
    {
      paidUpCapital: 32_00_000,
      turnover: 4_65_00_000,
      netWorth: 1_84_00_000,
      netProfit: 41_00_000,
      borrowings: 1_20_00_000,
      directorsCount: 3,
      // First AGM (FY 2019-20) appointed the auditor; re-appointed at the FY 2024-25 AGM.
      auditorAppointedAtAgmFy: 2025,
      agmHistory: ["2024-09-27"],
      filesDpt3: true,
    },
  ),
  client(
    "cl-satara",
    "Satara Textiles Limited",
    "L17110MH1994PLC076321",
    "public",
    "1994-03-11",
    "Plot 22, MIDC Industrial Area, Satara 415004",
    "active",
    "2025-09-12",
    {
      listed: true,
      paidUpCapital: 20_00_00_000,
      turnover: 3_50_00_00_000,
      netWorth: 1_20_00_00_000,
      netProfit: 8_00_00_000,
      borrowings: 60_00_00_000,
      directorsCount: 3,
      securitiesInDemat: true,
      auditorAppointedAtAgmFy: 2025,
      agmHistory: ["2024-09-20"],
      filesDpt3: true,
    },
  ),
  client(
    "cl-kavan",
    "Kavan Foods One Person Company Private Limited",
    "U15490GJ2022OPC131204",
    "opc",
    "2022-11-02",
    "Shop 7, Gokul Complex, Anand 388001",
    "active",
    null,
    { paidUpCapital: 5_00_000, turnover: 12_00_000, directorsCount: 1 },
  ),
  client(
    "cl-prerna",
    "Prerna Education Foundation",
    "U80904DL2017NPL318772",
    "section8",
    "2017-05-30",
    "B-14, Hauz Khas Enclave, New Delhi 110016",
    "active",
    null,
    { paidUpCapital: 1_00_000, turnover: 8_00_000, directorsCount: 2 },
  ),
  client(
    "cl-northline",
    "Northline Logistics LLP",
    "AAB-4471",
    "llp",
    "2021-01-19",
    "Unit 3, Transport Nagar, Kanpur 208023",
    "active",
    null,
    { llpContribution: 20_00_000, turnover: 35_00_000, directorsCount: 2 },
  ),
  client(
    "cl-varsha",
    "Varsha Chemicals Private Limited",
    "U24100TN2015PTC099413",
    "private",
    "2015-08-24",
    "112 Anna Salai, Chennai 600002",
    "dormant",
    null,
    {
      paidUpCapital: 10_00_000,
      turnover: 20_00_000,
      directorsCount: 2,
      msmeDuesOver45Days: true,
    },
  ),
];

function director(id, name, din, dinAllottedOn, lastKycFiledOn, directorships) {
  return {
    id,
    name,
    din,
    dinAllottedOn,
    lastKycFiledOn,
    directorships,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

export const SEED_DIRECTORS = [
  director("dr-ananya", "Ananya Raghavan", "07712345", "2016-06-14", "2026-05-20", [
    { clientId: "cl-meridian", role: "Managing Director", appointedOn: "2019-07-18" },
    { clientId: "cl-varsha", role: "Director", appointedOn: "2020-02-11" },
    { clientId: "cl-satara", role: "Independent Director", appointedOn: "2023-08-01" },
  ]),
  director("dr-farhan", "Farhan Qureshi", "08123456", "2018-09-03", null, [
    { clientId: "cl-meridian", role: "Director", appointedOn: "2021-04-01" },
    { clientId: "cl-northline", role: "Designated Partner", appointedOn: "2021-01-19" },
  ]),
  director("dr-leela", "Leela Menon", "09234567", "2021-12-08", null, [
    { clientId: "cl-meridian", role: "Nominee Director", appointedOn: "2023-11-20" },
  ]),
  director("dr-suresh", "Suresh Iyer", "01188220", "2009-04-22", "2023-09-14", [
    { clientId: "cl-satara", role: "Managing Director", appointedOn: "2011-06-30" },
    { clientId: "cl-prerna", role: "Director", appointedOn: "2017-05-30" },
    { clientId: "cl-varsha", role: "Director", appointedOn: "2015-08-24" },
  ]),
  director("dr-nita", "Nita Bhaskar", "03445901", "2013-02-19", "2026-04-02", [
    { clientId: "cl-satara", role: "Woman Director", appointedOn: "2019-11-05" },
  ]),
  director("dr-jaspreet", "Jaspreet Sahni", "06778120", "2015-10-30", null, [
    { clientId: "cl-kavan", role: "Director", appointedOn: "2022-11-02" },
    { clientId: "cl-prerna", role: "Director", appointedOn: "2018-01-15" },
    { clientId: "cl-northline", role: "Designated Partner", appointedOn: "2021-01-19" },
  ]),
];

export function seedSnapshot() {
  return {
    version: PORTFOLIO_VERSION,
    clients: SEED_CLIENTS,
    directors: SEED_DIRECTORS,
    consultants: [],
    activeClientId: SEED_CLIENTS[0].id,
  };
}
