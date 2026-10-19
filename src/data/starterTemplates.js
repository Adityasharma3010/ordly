// Ready-made lists offered on the home screen. Each item is { text, has_checkbox, children },
// so a template can hold nested sub-items as deep as it likes. Colours are keys from
// utils/appearance.js.
const task = (text, children = []) => ({ text, has_checkbox: true, children });
const note = (text) => ({ text, has_checkbox: false, children: [] });
const group = (text, kids) =>
  task(
    text,
    kids.map((k) => task(k)),
  );

export const STARTER_TEMPLATES = [
  {
    id: "starter-groceries",
    title: "Groceries",
    icon: "🛒",
    color: "sage",
    description: "Tick things off as you shop.",
    items: [
      group("Produce", [
        "Apples",
        "Bananas",
        "Leafy greens",
        "Tomatoes",
        "Onions",
      ]),
      group("Dairy and eggs", ["Milk", "Eggs", "Yogurt", "Butter or cheese"]),
      group("Pantry", [
        "Rice or pasta",
        "Bread",
        "Coffee or tea",
        "Cooking oil",
      ]),
      group("Household", ["Dish soap", "Toilet paper"]),
      note("Check the fridge before you go."),
    ],
  },
  {
    id: "starter-packing",
    title: "Packing list",
    icon: "🧳",
    color: "sky",
    description: "Everything to pack, grouped so nothing gets forgotten.",
    items: [
      group("Documents", [
        "Passport or ID",
        "Tickets and bookings",
        "Travel insurance",
        "Local currency",
      ]),
      group("Clothes", [
        "Underwear and socks",
        "Tops",
        "Trousers or skirts",
        "Sleepwear",
        "Jacket or sweater",
      ]),
      group("Toiletries", [
        "Toothbrush and toothpaste",
        "Deodorant",
        "Medication",
        "Sunscreen",
      ]),
      group("Tech", [
        "Phone charger",
        "Power bank",
        "Travel adapter",
        "Headphones",
      ]),
      group("Before you leave", [
        "Check windows and doors",
        "Take out the bin",
      ]),
    ],
  },
  {
    id: "starter-weekend",
    title: "Weekend to-dos",
    icon: "🏡",
    color: "amber",
    description: "A relaxed list for the weekend.",
    items: [
      group("Errands", [
        "Post office",
        "Pick up prescriptions",
        "Return a parcel",
      ]),
      group("Around the house", [
        "Laundry",
        "Tidy one room",
        "Water the plants",
      ]),
      group("Something fun", ["Call a friend", "Plan a walk or a film"]),
    ],
  },
  {
    id: "starter-project",
    title: "Project plan",
    icon: "🧭",
    color: "violet",
    description: "From a blank page to launch.",
    items: [
      group("Define", [
        "Goal, and what “done” looks like",
        "Who is involved",
        "Deadline",
      ]),
      group("Plan", [
        "Break the work into steps",
        "Estimate the effort",
        "Put the steps in order",
      ]),
      group("Build", [
        "First milestone",
        "Second milestone",
        "Review together",
      ]),
      group("Launch", ["Final checks", "Announce it", "Plan a look back"]),
      note("Review progress every Friday."),
    ],
  },
  {
    id: "starter-weekly-review",
    title: "Weekly review",
    icon: "🗓️",
    color: "rose",
    description: "Look back, plan ahead, tidy up.",
    items: [
      group("Look back", [
        "What went well?",
        "What did not?",
        "What did I learn?",
      ]),
      group("Plan ahead", [
        "Top three priorities",
        "Block time in the calendar",
        "Prepare for meetings",
      ]),
      group("Tidy up", ["Clear the inbox", "Archive finished lists"]),
    ],
  },
  {
    id: "starter-moving",
    title: "Moving day",
    icon: "📦",
    color: "coral",
    description: "Before, during and after the move.",
    items: [
      group("Four weeks before", [
        "Book movers",
        "Gather boxes",
        "Start decluttering",
      ]),
      group("The week of", [
        "Pack an essentials box",
        "Defrost the freezer",
        "Confirm who has the keys",
      ]),
      group("Moving day", [
        "Take meter readings",
        "Final walkthrough",
        "Hand back the keys",
      ]),
      group("After", ["Change your address", "Unpack the kitchen first"]),
    ],
  },
];
