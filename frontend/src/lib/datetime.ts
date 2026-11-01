// The API sends UTC ISO timestamps; users see them in their local time zone.
const dateTimeFormat = new Intl.DateTimeFormat('hr-HR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDateTime(isoUtc: string): string {
  return dateTimeFormat.format(new Date(isoUtc));
}
