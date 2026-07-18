export type RecordActionState = {
  status: "idle" | "success" | "error" | "conflict";
  message: string;
};

export const initialRecordActionState: RecordActionState = {
  status: "idle",
  message: "",
};
