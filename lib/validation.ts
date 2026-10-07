import { z } from 'zod';

const level = z.enum(['normal', 'above_normal']).nullable();
const optionalOverride = z.string().trim().max(120).nullable().optional();

export const entryPatchSchema = z
  .strictObject({
    responded: z.boolean().optional(),
    weather_option_id: z.uuid().nullable().optional(),
    wind_option_id: z.uuid().nullable().optional(),
    road: z.enum(['passable', 'unpassable']).nullable().optional(),
    river: level.optional(),
    coastal: level.optional(),
    power: z.enum(['with_power', 'no_power']).nullable().optional(),
    remarks: z.string().trim().max(500).nullable().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, { message: 'Nothing to update.' });
export type EntryPatch = z.infer<typeof entryPatchSchema>;

export const reportPatchSchema = z
  .strictObject({
    report_at: z.iso.datetime({ offset: true }).optional(),
    prepared_by_name: z.string().trim().min(1, 'Enter who prepared the report.').max(120).optional(),
    prepared_by_position: z.string().trim().max(120).optional(),
    remarks: z.string().trim().max(2000).optional(),
    weather_summary_override: optionalOverride,
    wind_summary_override: optionalOverride,
    rivers_summary_override: optionalOverride,
    roads_summary_override: optionalOverride,
    coastal_summary_override: optionalOverride,
  })
  .refine((patch) => Object.keys(patch).length > 0, { message: 'Nothing to update.' });
export type ReportPatch = z.infer<typeof reportPatchSchema>;

export const newReportSchema = z.object({
  report_at_local: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Choose the netcall date and time.')
    .refine((v) => !Number.isNaN(Date.parse(`${v}:00+08:00`)), 'Choose a valid netcall date and time.'),
  prepared_by_name: z.string().trim().min(1, 'Enter who prepared the report.').max(120),
  prepared_by_position: z.string().trim().max(120),
});

export const staffSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid Gmail address.')),
  full_name: z.string().trim().min(1, 'Enter the full name.').max(120),
  position: z.string().trim().max(120),
});

export const barangaySchema = z.object({
  name: z.string().trim().min(1, 'Enter the barangay name.').max(80),
  callsign: z.string().trim().min(1, 'Enter the callsign.').max(40),
  zone_id: z.uuid('Choose a zone.'),
  monitors_coastal: z.boolean(),
  is_active: z.boolean(),
});

export const optionSchema = z.object({
  kind: z.enum(['weather', 'wind']),
  label: z.string().trim().min(1, 'Enter a label.').max(60),
  severity: z.coerce.number().int().min(0).max(20),
  is_active: z.boolean(),
});

export const settingsSchema = z.object({
  office_title: z.string().trim().min(1).max(120),
  office_lines: z.array(z.string().trim().min(1).max(160)).max(5),
  network_name: z.string().trim().min(1).max(160),
  call_sign: z.string().trim().min(1).max(60),
  radio_frequency: z.string().trim().min(1).max(30),
  report_title: z.string().trim().min(1).max(120),
});
