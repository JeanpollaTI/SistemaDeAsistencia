import mongoose from "mongoose";

const columnSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: {
    type: String,
    enum: ["BOOLEAN_STATUS", "TEXT", "NUMBER", "PERCENTAGE"],
    default: "TEXT"
  },
  statusOptions: [
    {
      key: { type: String, required: true },
      label: { type: String, required: true },
      color: { type: String, default: "#22c55e" }
    }
  ]
}, { _id: false });

const groupAssignmentSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Grupo",
    required: true
  },
  teachers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ]
}, { _id: false });

const customTableTemplateSchema = new mongoose.Schema(
  {
    school_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    rowType: {
      type: String,
      enum: ["STUDENTS", "GROUPS"],
      default: "STUDENTS"
    },
    assignedGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Grupo",
      default: null
    },
    authorizedTeachers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    groupAssignments: [groupAssignmentSchema],
    columns: [columnSchema],
    isActive: {
      type: Boolean,
      default: true
    },
    isBuiltIn: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

export default mongoose.model("CustomTableTemplate", customTableTemplateSchema);
