import { rbacRequest } from "../rbacClient";
import type {
  CreatePersonalDocTagRequest,
  PersonalDocTag,
  UpdatePersonalDocTagRequest,
} from "../types";

/** The list endpoint returns tags under one of several keys depending on API version. */
const extractTagList = (data: any): PersonalDocTag[] => {
  if (Array.isArray(data.personal_doc_tags)) return data.personal_doc_tags;
  if (Array.isArray(data.personal_tags)) return data.personal_tags;
  if (Array.isArray(data.tags)) return data.tags;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  return [];
};

const extractTag = (data: any): PersonalDocTag =>
  data.personal_doc_tag || data.tag || data.personal_tag || data;

export const personalDocTagsApi = {
  list: async (params?: { limit?: number }): Promise<PersonalDocTag[]> => {
    const data = await rbacRequest<any>("/personal-doc-tag/list", {
      query: { limit: params?.limit },
    });
    return extractTagList(data);
  },

  create: async (
    tagData: CreatePersonalDocTagRequest
  ): Promise<PersonalDocTag> => {
    const data = await rbacRequest<any>("/personal-doc-tag/", {
      method: "POST",
      body: tagData,
    });
    return extractTag(data);
  },

  update: async (
    tagId: number,
    updateData: UpdatePersonalDocTagRequest
  ): Promise<PersonalDocTag> => {
    const data = await rbacRequest<any>(`/personal-doc-tag/${tagId}`, {
      method: "PUT",
      body: updateData,
    });
    return extractTag(data);
  },

  delete: async (tagId: number): Promise<void> => {
    await rbacRequest(`/personal-doc-tag/${tagId}`, { method: "DELETE" });
  },
};
