// The API sends UTC ISO timestamps; users see them in their local time zone.
const dateTimeFormat = new Intl.DateTimeFormat('hr-HR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDateTime(isoUtc: string): string {
  return dateTimeFormat.format(new Date(isoUtc));
}

// Abbreviated units ("2 d 4 h 30 min") sidestep Croatian plural forms.
export function formatDuration(startIsoUtc: string, endIsoUtc: string): string {
  const totalMinutes = Math.max(
    0,
    Math.round(
      (new Date(endIsoUtc).getTime() - new Date(startIsoUtc).getTime()) /
        60_000,
    ),
  );
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts = [
    days > 0 && `${days} d`,
    hours > 0 && `${hours} h`,
    minutes > 0 && `${minutes} min`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '0 min';
}
