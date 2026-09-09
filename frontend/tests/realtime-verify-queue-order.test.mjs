import test from "node:test";
import assert from "node:assert/strict";
import { mapVerifyPatientsToQueue } from "../src/lib/verify-prescriptions-adapter.ts";

function prescription(vn, pn, createdAt) {
  return {
    CREATEDATETIME: createdAt,
    VISITDATETIME: "2026-09-09",
    VISITNUMBER: vn,
    PRESCRIPTIONNUMBER: pn,
    SOURCE_REVISION: `revision-${vn}`,
    CLINIC_CODE: null,
    LOCALWARDNAME: null,
    DOCTOR: { DOCTORCODE: null, LOCALDOCTORNAME: null },
    ITEMS: [],
  };
}

test("orders Verify visits by their first prescription so new VNs stay at the end", () => {
  const patients = [
    {
      PATIENTID: "HN-LATE",
      FULLNAME_TH: "Late patient",
      PRESCRIPTIONS: [prescription("VN-LATE", "01", "2026-09-09T09:15:00.000Z")],
    },
    {
      PATIENTID: "HN-EARLY",
      FULLNAME_TH: "Early patient",
      PRESCRIPTIONS: [
        prescription("VN-EARLY", "01", "2026-09-09T08:00:00.000Z"),
        prescription("VN-EARLY", "02", "2026-09-09T10:30:00.000Z"),
      ],
    },
  ];

  const result = mapVerifyPatientsToQueue(patients, patients.length);

  assert.deepEqual(result.patients.map((patient) => patient.vn), ["VN-EARLY", "VN-LATE"]);
  assert.equal(result.patients[0].prescriptionCreatedAt, "2026-09-09T08:00:00.000Z");
});
