import mongoose from "mongoose";

const customTableRowDataSchema = new mongoose.Schema(
  {
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomTableTemplate",
      required: true,
      index: true
    },
    school_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Grupo",
      default: null,
      index: true
    },
    rowEntityId: {
      type: String,
      required: true,
      index: true
    },
    rowEntityName: {
      type: String,
      default: ""
    },
    data: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
    },
    rowColorTag: {
      type: String,
      default: ""
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { timestamps: true }
);

customTableRowDataSchema.index({ tableId: 1, rowEntityId: 1 }, { unique: true });

export default mongoose.model("CustomTableRowData", customTableRowDataSchema);
