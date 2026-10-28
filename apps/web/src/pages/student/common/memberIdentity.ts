/** Display only the canonical identity assigned and returned by the backend. */
export function medpulseMemberId(member: { medpulse_id?: string | null }): string {
    return member.medpulse_id || '';
}
