// What's new: one entry per APK build, newest first. Human-edited; see AGENTS.md before each build.
// `id` is what the phone remembers as seen, so every build that should show notes needs a new, unique id.
export type Entry = { id: string; title: string; items: string[] };

export const CHANGELOG: Entry[] = [
  {
    id: '2026-09-25',
    title: 'Cook with confidence',
    items: [
      'Read written cooking instructions for every dish in the app.',
      'See a notice when a newer app version is available to download.',
    ],
  },
  {
    id: '2026-09-23',
    title: 'Plan the week, shop together',
    items: [
      'Browse Filipino dishes, with category chips and search.',
      'Open a dish to see what goes in it, and add it to this week.',
      'Pick dishes and get one market list, merged and grouped by aisle.',
      'Tick items off as you shop, even with no signal. Tapped by mistake? Undo it until it syncs.',
      'Share a list with your partner by email invite and watch each other’s ticks arrive live.',
      'Every ingredient, aisle and category now shows in plain English.',
      'History keeps your finished trips, and Repeat puts one back on your list.',
    ],
  },
];
