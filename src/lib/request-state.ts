export type CreateTaskField = "type" | "startDate" | "endDate" | "hours" | "note";

export type CreateTaskActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<CreateTaskField, string>>;
  task?: {
    id: string;
    employeeId: string;
    type: string;
    startDate: string;
    endDate: string;
    hours: number;
    note?: string;
    status: "Pending";
  };
};

export const CREATE_TASK_INITIAL_STATE: CreateTaskActionState = {
  status: "idle",
};
