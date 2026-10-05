import { StudentAttendanceRoom } from './StudentAttendanceRoom';

export interface FillableLecture {
    id?: number;
    lecture_id?: number;
    lecture_no?: number | string;
    subject?: string | null;
    subject_name?: string | null;
    subject_code?: string | null;
    date_iso?: string | null;
    lecture_date?: string | null;
    card_date?: string | null;
    time_slot?: string | null;
    card_time?: string | null;
    faculty_name?: string | null;
    venue?: string | null;
    room_no?: string | null;
    topic?: string | null;
    attendance_requested?: boolean;
    attendance_status?: string | null;
}

export function FillAttendanceModal({ open, session, onClose, onSuccess }: {
    open: boolean; session: FillableLecture | null; onClose: () => void; onSuccess: (message: string) => void;
}) {
    if (!open) return null;
    return <StudentAttendanceRoom key={session?.id ?? session?.lecture_id ?? 'all'}
        lectureId={session?.id ?? session?.lecture_id} onClose={onClose} onSuccess={onSuccess}/>;
}
