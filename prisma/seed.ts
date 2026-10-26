import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SYSTEM_CATEGORIES = [
  {
    name: "🍔 Food & Dining",
    icon: "🍔",
    color: "#FFB74D",
    children: [
      { name: "Groceries", icon: "🛒", color: "#F9A825" },
      { name: "Restaurants", icon: "🍽️", color: "#EF5350" },
      { name: "Takeout", icon: "🥡", color: "#8E24AA" },
      { name: "Coffee", icon: "☕", color: "#6D4C41" },
    ],
  },
  {
    name: "🏠 Housing",
    icon: "🏠",
    color: "#4CAF50",
    children: [
      { name: "Rent", icon: "🏘️", color: "#388E3C" },
      { name: "Mortgage", icon: "🏡", color: "#2E7D32" },
      { name: "Home Maintenance", icon: "🔧", color: "#6D4C41" },
      { name: "Home Insurance", icon: "🛡️", color: "#1976D2" },
    ],
  },
  {
    name: "⚡ Utilities",
    icon: "⚡",
    color: "#0288D1",
    children: [
      { name: "Electricity", icon: "💡", color: "#FDD835" },
      { name: "Gas", icon: "🔥", color: "#F4511E" },
      { name: "Water", icon: "💧", color: "#0288D1" },
      { name: "Internet", icon: "🌐", color: "#5E35B1" },
      { name: "Mobile Phone", icon: "📱", color: "#039BE5" },
    ],
  },
  {
    name: "🚗 Transport",
    icon: "🚗",
    color: "#EF6C00",
    children: [
      { name: "Fuel", icon: "⛽", color: "#F57C00" },
      { name: "Car Maintenance", icon: "🛠️", color: "#6D4C41" },
      { name: "Parking", icon: "🅿️", color: "#616161" },
      { name: "Public Transport", icon: "🚌", color: "#00796B" },
      { name: "Car Insurance", icon: "🚘", color: "#0288D1" },
    ],
  },
  {
    name: "🏦 Loans & Credit",
    icon: "🏦",
    color: "#5D4037",
    children: [
      { name: "Bank Loan — House", icon: "🏠", color: "#3E2723" },
      { name: "Bank Loan — Car", icon: "🚗", color: "#4E342E" },
      { name: "Bank Loan — Other", icon: "💳", color: "#6D4C41" },
      { name: "Card Payment", icon: "💳", color: "#455A64" },
    ],
  },
  {
    name: "🏥 Healthcare",
    icon: "🏥",
    color: "#D32F2F",
    children: [
      { name: "Doctor", icon: "👨‍⚕️", color: "#C62828" },
      { name: "Pharmacy", icon: "🏥", color: "#AD1457" },
      { name: "Health Insurance", icon: "🩺", color: "#1976D2" },
      { name: "Dentist", icon: "🦷", color: "#7B1FA2" },
    ],
  },
  {
    name: "🎬 Entertainment",
    icon: "🎬",
    color: "#8E24AA",
    children: [
      { name: "Streaming", icon: "🎥", color: "#8E24AA" },
      { name: "Cinema", icon: "🎞️", color: "#6A1B9A" },
      { name: "Events", icon: "🎟️", color: "#C2185B" },
      { name: "Hobbies", icon: "🎨", color: "#5D4037" },
    ],
  },
  {
    name: "🛍️ Shopping",
    icon: "🛍️",
    color: "#6D4C41",
    children: [
      { name: "Clothing", icon: "👗", color: "#AD1457" },
      { name: "Electronics", icon: "💻", color: "#1976D2" },
      { name: "Home & Garden", icon: "🏡", color: "#388E3C" },
    ],
  },
  {
    name: "🎓 Education",
    icon: "🎓",
    color: "#283593",
    children: [
      { name: "Courses", icon: "📚", color: "#3949AB" },
      { name: "Books", icon: "📖", color: "#6A1B9A" },
      { name: "School Fees", icon: "🏫", color: "#1E88E5" },
    ],
  },
  {
    name: "✈️ Travel",
    icon: "✈️",
    color: "#0288D1",
    children: [
      { name: "Flights", icon: "🛫", color: "#0288D1" },
      { name: "Hotels", icon: "🏨", color: "#00796B" },
      { name: "Vacation", icon: "🏝️", color: "#6D4C41" },
    ],
  },
  {
    name: "🔁 Subscriptions",
    icon: "🔁",
    color: "#00897B",
    children: [
      { name: "Software", icon: "💾", color: "#0277BD" },
      { name: "Apps", icon: "📱", color: "#0288D1" },
      { name: "Memberships", icon: "🪪", color: "#6A1B9A" },
    ],
  },
  {
    name: "💸 Cash Withdraw",
    icon: "💸",
    color: "#455A64",
    children: [
      { name: "ATM Withdrawal", icon: "🏧", color: "#546E7A" },
      { name: "Cash Expense", icon: "💵", color: "#607D8B" },
    ],
  },
  {
    name: "📦 Other Expense",
    icon: "📦",
    color: "#546E7A",
    children: [],
  },
  {
    name: "💼 Employment",
    icon: "💼",
    color: "#388E3C",
    children: [
      { name: "Salary", icon: "💰", color: "#2E7D32" },
      { name: "Bonus", icon: "🎉", color: "#FDD835" },
      { name: "Commission", icon: "📈", color: "#1976D2" },
    ],
  },
  {
    name: "💻 Self-Employment",
    icon: "💻",
    color: "#6A1B9A",
    children: [
      { name: "Freelance", icon: "🧑‍💻", color: "#5E35B1" },
      { name: "Business Revenue", icon: "📊", color: "#00897B" },
    ],
  },
  {
    name: "🏘️ Passive Income",
    icon: "🏘️",
    color: "#2E7D32",
    children: [
      { name: "Rental Income", icon: "🏠", color: "#388E3C" },
      { name: "Dividends", icon: "📈", color: "#43A047" },
      { name: "Interest", icon: "💵", color: "#1E88E5" },
    ],
  },
  {
    name: "🎁 Other Income",
    icon: "🎁",
    color: "#D81B60",
    children: [
      { name: "Gift", icon: "🎁", color: "#8E24AA" },
      { name: "Investment Sale", icon: "💹", color: "#1976D2" },
      { name: "Other", icon: "🔔", color: "#546E7A" },
    ],
  },
];

async function main() {
  for (const category of SYSTEM_CATEGORIES) {
    let parent = await prisma.category.findFirst({
      where: {
        name: category.name,
        userId: null,
        parentId: null,
      },
    });

    if (!parent) {
      parent = await prisma.category.create({
        data: {
          name: category.name,
          icon: category.icon,
          color: category.color,
          isSystem: true,
        },
      });
    } else {
      await prisma.category.update({
        where: { id: parent.id },
        data: {
          icon: category.icon,
          color: category.color,
        },
      });
    }

    for (const child of category.children) {
      const existingChild = await prisma.category.findFirst({
        where: {
          name: child.name,
          userId: null,
          parentId: parent.id,
        },
      });

      if (!existingChild) {
        await prisma.category.create({
          data: {
            name: child.name,
            icon: child.icon,
            color: child.color,
            isSystem: true,
            parentId: parent.id,
          },
        });
      } else {
        await prisma.category.update({
          where: { id: existingChild.id },
          data: {
            icon: child.icon,
            color: child.color,
          },
        });
      }
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
