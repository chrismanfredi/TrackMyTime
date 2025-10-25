"use client";

import Image from "next/image";
import { DashboardShell } from "@/components/dashboard-shell";

type Employee = {
  id: string;
  name: string;
  role: string;
  photo: string;
};

const employees: Employee[] = [
  {
    id: "chris-manfredi",
    name: "Chris Manfredi",
    role: "Time Off Manager",
    photo: "/images/man.png",
  },
  {
    id: "alex-wilson",
    name: "Alex Wilson",
    role: "Product Designer",
    photo: "/images/man.png",
  },
  {
    id: "jordan-lee",
    name: "Jordan Lee",
    role: "Engineering Manager",
    photo: "/images/man.png",
  },
  {
    id: "priya-patel",
    name: "Priya Patel",
    role: "QA Analyst",
    photo: "/images/woman.png",
  },
  {
    id: "nina-chen",
    name: "Nina Chen",
    role: "Customer Success Lead",
    photo: "/images/woman.png",
  },
  {
    id: "omar-hassan",
    name: "Omar Hassan",
    role: "People Operations",
    photo: "/images/man.png",
  },
  {
    id: "sofia-martinez",
    name: "Sofia Martinez",
    role: "Senior Account Executive",
    photo: "/images/woman.png",
  },
];

const navigation = [
  { label: "Overview", href: "/", active: false },
  { label: "Employees", href: "/employees", active: true },
  { label: "Time Off", href: "/time-off", active: false },
];

export default function EmployeesPage() {
  return (
    <DashboardShell
      navigation={navigation}
      title="Employee directory"
      badge="Team Hub"
    >
      <section className="flex w-full flex-col gap-8">

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((employee) => (
            <article
              key={employee.id}
              className="flex flex-col items-center rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="relative h-24 w-24 overflow-hidden rounded-full border border-zinc-100 shadow-sm">
                <Image
                  src={employee.photo}
                  alt={`${employee.name} portrait`}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-zinc-900">
                {employee.name}
              </h2>
              <p className="text-sm text-zinc-500">{employee.role}</p>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
