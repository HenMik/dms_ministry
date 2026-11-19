export interface UserLite {
    id: number;
    first_name: string;
    last_name: string;
    name?: string;
    full_name?: string;
    email?: string;
    is_approver?: boolean;
}

export interface Category {
    id: number;
    name: string;
    label?: string;
    parent_id?: number | null;
    department_ids?: number[];
    documents_count?: number;
    folders_count?: number;
    updated_at?: string;
}

export interface Annotation {
    id: number;
    document_id: number;
    user_id: number;
    user?: UserLite | null;
    annotation_type: 'COMMENT' | 'HIGHLIGHT' | 'NOTE';
    page_number: number;
    coordinates: {
        x: number;
        y: number;
        w?: number;
        h?: number;
        size?: number;
        bold?: boolean;
        italic?: boolean;
    } | null;
    content: string;
    color: string;
    resolved: boolean;
    created_at: string;
}

export interface Placement {
    page: number;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface DocumentSignatureRecord {
    id: number;
    user_id: number;
    user?: UserLite | null;
    signature_type?: 'INTERNAL' | 'STAMP' | string;
    signed_at: string;
    verification_certificate: string;
    is_current?: boolean;
    signature_data: {
        image?: string;
        placements?: Placement[];
        sha256?: string;
        file_path?: string | null;
        previous_file_path?: string | null;
    } | null;
}

export interface DocumentRecord {
    id: number;
    title: string;
    description: string;
    status: string;
    version: number;
    mime_type: string;
    file_size: number;
    is_pdf: boolean;
    is_signed: boolean;
    requires_approval: boolean;
    access_expires_at: string | null;
    category?: Category | null;
    category_id?: number | null;
    uploaded_by?: UserLite | null;
    created_at: string;
    updated_at: string;
    signatures_count?: number;
    annotations?: Annotation[];
    signatures?: DocumentSignatureRecord[];
    approved_by?: (UserLite & { pivot?: { approved_at: string } })[];
    pending_approvers?: UserLite[];
    visible_to?: UserLite[];
}

export interface MeetingType {
    id: number;
    name: string;
}

export interface AgendaItem {
    id?: number;
    title: string;
    description: string;
    order?: number;
    presenter_id?: number | null;
    presenter?: UserLite | null;
    estimated_duration?: number;
}

export interface Attendance {
    id: number;
    user_id: number;
    user?: UserLite;
    attended: boolean;
    attendance_type: string;
}

export interface Meeting {
    id: number;
    title: string;
    description: string;
    scheduled_at: string;
    duration_minutes: number;
    location: string;
    virtual_meeting_url: string;
    status: string;
    quorum_required: number;
    quorum_met: boolean;
    meeting_type_id?: number | null;
    meeting_type?: MeetingType | null;
    organizer_id?: number | null;
    secretary_id?: number | null;
    chairperson_id?: number | null;
    organizer?: UserLite | null;
    secretary?: UserLite | null;
    chairperson?: UserLite | null;
    committee_id?: number | null;
    committee?: { id: number; name: string } | null;
    recorder_id?: number | null;
    recorder?: UserLite | null;
    required_attendees?: UserLite[];
    optional_attendees?: UserLite[];
    agenda_items?: AgendaItem[];
    attendances?: Attendance[];
    board_pack?: { id: number; status: string; title?: string; sections_count?: number } | null;
    minute?: { id: number; status: string; title?: string } | null;
    required_attendees_count?: number;
    agenda_items_count?: number;
}

export type SectionType = 'AGENDA' | 'PREVIOUS_MINUTES' | 'REPORT' | 'POLICY_REVIEW' | 'TRAININGS' | 'DOCUMENT';
export type SectionStatus = 'PENDING' | 'REQUESTED' | 'SUBMITTED' | 'RETURNED' | 'READY';

/** TipTap / ProseMirror JSON document. */
export interface RichDoc {
    type: 'doc';
    content?: unknown[];
}

export interface CommitteeLite {
    id: number;
    name: string;
    default_rep_name?: string | null;
    default_rep_title?: string | null;
    default_rep_phone?: string | null;
    default_rep_email?: string | null;
}

export interface AgendaChild {
    title: string;
    section_id: number | null;
}

export interface AgendaEntry {
    title: string;
    presenter: string | null;
    section_id: number | null;
    custom?: boolean;
    children: AgendaChild[];
}

export interface AgendaData {
    venue: string;
    date: string | null;
    time: string | null;
    preliminaries: string[];
    items: AgendaEntry[];
    closing: string[];
}

export interface PolicyRow {
    policy: string;
    status: 'NEW' | 'OLD';
    summary: string;
    changes: string;
}

export interface TrainingRow {
    training: string;
    exposure: string;
    participants: string;
    venue: string;
    dates: string;
}

export interface SectionAttachment {
    id: number;
    title: string;
    mime_type: string | null;
    file_size: number | null;
    document: { id: number; title: string; status: string } | null;
    is_pdf: boolean;
    url: string;
}

export interface SectionRequestRecord {
    id: number;
    recipient_name: string;
    recipient_title: string | null;
    recipient_phone: string;
    recipient_email: string | null;
    expires_at: string;
    verified_at: string | null;
    last_opened_at: string | null;
    submitted_at: string | null;
    revoked_at: string | null;
    created_at: string;
    created_by?: UserLite | null;
    is_active: boolean;
}

export interface PackSection {
    id: number;
    type: SectionType;
    title: string;
    order: number;
    committee_id: number | null;
    committee: CommitteeLite | null;
    content: RichDoc | null;
    data: Record<string, unknown> | null;
    status: SectionStatus;
    required: boolean;
    due_at: string | null;
    prepared_by_name: string | null;
    prepared_by_title: string | null;
    presented_by_name: string | null;
    presented_by_title: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
    reviewed_by?: UserLite | null;
    review_note: string | null;
    locked: boolean;
    updated_at: string;
    html: string;
    attachments: SectionAttachment[];
    renders_page: boolean;
    pdf_url: string;
    previous_minute: { id: number; title: string; status: string; meeting: { id: number; title: string; scheduled_at: string } | null } | null;
    requests: SectionRequestRecord[];
}

export interface BoardPack {
    id: number;
    title: string;
    description: string;
    status: string;
    version: number;
    pdf_file: string | null;
    exported_at: string | null;
    published_at?: string | null;
    created_at: string;
    meeting?: (Pick<Meeting, 'id' | 'title' | 'scheduled_at' | 'location' | 'status'> & { committee?: { id: number; name: string } | null }) | null;
    template?: { id: number; name: string } | null;
    created_by?: UserLite | null;
    exported_by?: UserLite | null;
    sections_count?: number;
    ready_sections_count?: number;
}

export interface Resolution {
    id: number;
    title: string;
    description: string;
    resolution_text: string;
    status: string;
    adopted_at: string | null;
}

export interface ActionItem {
    id: number;
    title: string;
    description: string;
    status: string;
    priority: string;
    due_date: string | null;
    assigned_to?: UserLite | null;
    meeting?: { id: number; title: string } | null;
    minute_id?: number | null;
}

export interface MinuteSignatureRecord {
    id: number;
    user_id: number;
    user?: UserLite | null;
    signed_at: string;
    signature_data: { image?: string; sha256?: string } | null;
}

export interface Minute {
    id: number;
    meeting_id: number;
    title: string;
    content: string;
    proceedings?: Proceedings | null;
    status: string;
    requires_approval: boolean;
    approved_at: string | null;
    created_at: string;
    updated_at: string;
    meeting?: Pick<Meeting, 'id' | 'title' | 'scheduled_at'> | null;
    created_by?: UserLite | null;
    approved_by?: (UserLite & { pivot?: { approved_at: string } })[];
    signatures?: MinuteSignatureRecord[];
    resolutions?: Resolution[];
    action_items?: ActionItem[];
}

export interface ProceedingsPerson {
    name: string;
    position: string;
}

export interface ProceedingsItem {
    agenda_item_id: number | null;
    title: string;
    presenter: string;
    notes: RichDoc | null;
    resolution: string;
    proposed_by: string;
    seconded_by: string;
}

export interface Proceedings {
    venue: string;
    date: string | null;
    start_time: string | null;
    chaired_by: ProceedingsPerson;
    guests: string;
    preliminaries: {
        call_to_order: ProceedingsPerson & { notes: string };
        opening_prayer: ProceedingsPerson;
        quorum: { met: boolean | null; notes: string };
        agenda_adoption: { proposed_by: string; seconded_by: string };
        opening_remarks: ProceedingsPerson & { notes: string };
        previous_minutes: { proposed_by: string; seconded_by: string; notes: string };
        conflict_of_interest: string;
    };
    items: ProceedingsItem[];
    aob: RichDoc | null;
    adjournment: { time: string; closing_remarks_by: string; closing_prayer_by: string };
}

export interface AppNotificationRecord {
    id: number;
    notification_type: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    url: string | null;
}

export function fullName(u: UserLite | null | undefined): string {
    if (!u) return '—';
    return u.name ?? u.full_name ?? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();
}
