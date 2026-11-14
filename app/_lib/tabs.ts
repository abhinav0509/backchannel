/** The report's tabs. A plain module, so the server page can read the list (a client module would hand it a reference). */
export const TABS = ['brief', 'company', 'people', 'money', 'ai', 'outlook', 'prep', 'sources'] as const
export type Tab = (typeof TABS)[number]
