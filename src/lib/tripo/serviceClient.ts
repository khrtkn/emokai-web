/* eslint-disable no-console */
import axios from "axios";
import FormData from "form-data";
import { createReadStream, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type ImageToModelOptions = {
  modelVersion?: string;
  faceLimit?: number;
  pbr?: boolean;
  texture?: "no" | "standard" | "HD";
  quad?: boolean;
  outFormat?: string;
  style?: string;
  negativePrompt?: string;
  textureSeed?: number;
  seed?: number;
  orientation?: "default" | "align_image";
  textureAlignment?: "original_image" | "geometry";
  autoSize?: boolean;
};

export type ConvertModelFormat = "GLTF" | "USDZ";

export type ConvertModelOptions = {
  format: ConvertModelFormat;
  originalModelTaskId?: string;
  modelUrl?: string;
  faceLimit?: number;
  quad?: boolean;
  maxWaitMs?: number;
};

export type RiggingOptions = {
  rigType?: string;
  outputFormat?: string;
  maxWaitMs?: number;
  applyAnimation?: boolean;
};

export type AnimationOptions = {
  outputFormat?: string;
  maxWaitMs?: number;
};

export class TripoClient {
  readonly apiKey: string;
  readonly baseURL: string;

  constructor(apiKey: string, baseURL = "https://api.tripo3d.ai/v2/openapi") {
    if (!apiKey) {
      throw new Error("TRIPO API key is required");
    }
    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/$/, "");
  }

  async uploadImage(imagePath: string): Promise<string> {
    const absolutePath = path.resolve(imagePath);
    const stats = await fs.stat(absolutePath).catch(() => null);
    if (!stats) {
      throw new Error(`Image file does not exist: ${absolutePath}`);
    }
    if (stats.size === 0) {
      throw new Error("Image file is empty");
    }

    const form = new FormData();
    form.append("file", createReadStream(absolutePath), {
      filename: path.basename(absolutePath),
      contentType: getContentType(absolutePath)
    });

    try {
      const response = await axios.post(
        `${this.baseURL}/upload`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${this.apiKey}`
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 30_000
        }
      );

      const token = response.data?.data?.image_token;
      if (!token) {
        throw new Error("No image token received from upload");
      }

      return token;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data) {
        throw new Error(`Upload failed: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async createImage3DTask(imageToken: string, options: ImageToModelOptions = {}): Promise<string> {
    const payload = {
      type: "image_to_model" as const,
      file: {
        type: options.texture === "HD" ? "png" : "png",
        file_token: imageToken
      },
      model_version: options.modelVersion ?? "v2.5-20250123",
      face_limit: options.faceLimit ?? 2500,
      pbr: options.pbr !== false,
      out_format: options.outFormat ?? "glb",
      style: options.style,
      negative_prompt: options.negativePrompt,
      texture_seed: options.textureSeed,
      seed: options.seed,
      orientation: options.orientation,
      texture_alignment: options.textureAlignment,
      auto_size: options.autoSize
    };

    console.log("📤 Sending to TRIPO API:", JSON.stringify(payload, null, 2));

    try {
      const response = await axios.post(
        `${this.baseURL}/task`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`
          },
          timeout: 30_000
        }
      );

      const taskId = response.data?.data?.task_id ?? response.data?.task_id;
      if (!taskId) {
        throw new Error("No task ID received");
      }

      return taskId;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data as { code?: number };
        if (errorData.code === 2008) {
          throw new Error("Image rejected: Content policy violation");
        }
        if (errorData.code === 2014) {
          throw new Error("Image rejected: Failed content audit");
        }
        throw new Error(`Task creation failed: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async createConversionTask(options: ConvertModelOptions): Promise<string> {
    if (!options.modelUrl && !options.originalModelTaskId) {
      throw new Error("convert_model requires either modelUrl or originalModelTaskId");
    }

    const payload: Record<string, unknown> = {
      type: "convert_model",
      format: options.format
    };

    if (options.modelUrl) {
      payload.model_url = options.modelUrl;
    }

    if (options.originalModelTaskId) {
      payload.original_model_task_id = options.originalModelTaskId;
    }

    if (typeof options.faceLimit === "number") {
      payload.face_limit = options.faceLimit;
    }

    if (typeof options.quad === "boolean") {
      payload.quad = options.quad;
    }

    console.log("📤 Sending conversion request:", JSON.stringify(payload, null, 2));

    try {
      const response = await axios.post(
        `${this.baseURL}/task`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`
          },
          timeout: 30_000
        }
      );

      const taskId = response.data?.data?.task_id ?? response.data?.task_id;
      if (!taskId) {
        throw new Error("No conversion task ID received");
      }

      return taskId;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data) {
        throw new Error(`Conversion task creation failed: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async convertModel(options: ConvertModelOptions) {
    const taskId = await this.createConversionTask(options);
    const output = await this.pollTask(taskId, options.maxWaitMs);
    return { taskId, output };
  }

  async getTaskStatus(taskId: string): Promise<Record<string, any>> {
    try {
      const response = await axios.get(
        `${this.baseURL}/task/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`
          },
          timeout: 30_000
        }
      );

      return response.data?.data ?? response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data) {
        throw new Error(`Status check failed: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async pollTask(taskId: string, maxWaitMs = 600_000): Promise<Record<string, any>> {
    const pollInterval = 5000;
    const maxAttempts = Math.floor(maxWaitMs / pollInterval);

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const taskData = await this.getTaskStatus(taskId);
      const status = taskData.status;

      if (status === "success") {
        console.log("✅ Task completed successfully. Output URLs:", {
          model: taskData.output?.model,
          pbr_model: taskData.output?.pbr_model,
          rigged_model: taskData.output?.rigged_model
        });
        return { ...taskData.output, success: true };
      }

      if (status === "failed") {
        throw new Error(`Task failed: ${JSON.stringify(taskData)}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Task timed out after ${maxWaitMs}ms`);
  }

  async generateFromImage(
    imagePath: string,
    options: ImageToModelOptions & RiggingOptions = {}
  ) {
    const localPath = await this.ensureLocalFile(imagePath);
    const imageToken = await this.uploadImage(localPath);
    const taskId = await this.createImage3DTask(imageToken, options);
    let output = await this.pollTask(taskId, options.maxWaitMs);

    console.log("🔍 Debug - Rigging check:");
    console.log("  - options.rigType:", options.rigType);
    console.log("  - output.success:", output.success);
    console.log("  - output keys:", Object.keys(output ?? {}));
    console.log("  - Should apply rigging?:", !!(options.rigType && output.success));

    const needsRigging = options.rigType || options.outputFormat === "fbx";

    if (needsRigging && output.success) {
      const rigType = options.rigType || (options.outputFormat === "fbx" ? "biped" : null);

      if (rigType) {
        console.log(
          `🦴 Applying rigging: ${rigType}${options.outputFormat === "fbx" ? " (for FBX format)" : ""}`
        );
        try {
          const riggedOutput = await this.applyRigging(taskId, rigType, options);
          output = { ...output, ...riggedOutput, rigged: true };
          console.log("✅ Rigging applied successfully");
        } catch (error: any) {
          console.warn("⚠️ Rigging failed, returning unrigged model:", error.message);
        }
      }
    }

    return output;
  }

  async applyRigging(taskId: string, rigType: string, options: RiggingOptions = {}) {
    console.log(`🦴 Attempting to apply ${rigType} rigging to task ${taskId}`);

    const rigTypeMap: Record<string, string> = {
      biped: "biped",
      quadruped: "quadruped",
      hexapod: "hexapod",
      octopod: "octopod",
      avian: "avian",
      serpentine: "serpentine",
      aquatic: "aquatic"
    };

    const mappedRigType = rigTypeMap[rigType] || "biped";

    try {
      const payload = {
        type: "animate_rig" as const,
        original_model_task_id: taskId,
        rig_type: mappedRigType,
        out_format: options.outputFormat ?? "glb",
        model_version: "v2.0-20250506",
        spec: "tripo"
      };

      console.log("🦴 Rigging payload:", payload);

      const response = await axios.post(`${this.baseURL}/task`, payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        timeout: 30_000
      });

      const rigTaskId = response.data?.data?.task_id;
      if (!rigTaskId) {
        throw new Error("No rigging task ID received");
      }

      console.log(`🦴 Rigging task created: ${rigTaskId}`);
      const riggedOutput = await this.pollTask(rigTaskId, options.maxWaitMs);

      if (riggedOutput.success && riggedOutput.model) {
        console.log("✅ Model successfully rigged!");

        if (options.applyAnimation !== false) {
          try {
            console.log("🚶 Applying default walking animation...");
            const animatedOutput = await this.applyAnimation(rigTaskId, "walk", options);

            if (
              animatedOutput.success &&
              "animated_model" in animatedOutput &&
              animatedOutput.animated_model
            ) {
              return {
                ...riggedOutput,
                ...animatedOutput,
                model: animatedOutput.animated_model,
                rigged_model: riggedOutput.model,
                animated_model: animatedOutput.animated_model,
                rig_type: mappedRigType,
                animation_type: "walk",
                success: true
              };
            }
          } catch (animError: any) {
            console.warn("⚠️ Animation failed, returning rigged model without animation:", animError.message);
          }
        }

        return {
          ...riggedOutput,
          rigged_model: riggedOutput.model,
          rig_type: mappedRigType,
          success: true
        };
      }

      return { ...riggedOutput, success: true };
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.data) {
        console.error("🦴 Rigging API error:", error.response.data);
      }
      throw new Error(`Rigging failed: ${error.message}`);
    }
  }

  async applyAnimation(
    riggedTaskId: string,
    animationType = "walk",
    options: AnimationOptions = {}
  ) {
    console.log(`🚶 Applying ${animationType} animation to rigged model`);

    try {
      const payload = {
        type: "animate_retarget" as const,
        original_model_task_id: riggedTaskId,
        animation: animationType,
        out_format: options.outputFormat ?? "fbx",
        model_version: "v2.0-20250506"
      };

      console.log("🎬 Animation payload:", payload);

      const response = await axios.post(`${this.baseURL}/task`, payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        timeout: 30_000
      });

      const animTaskId = response.data?.data?.task_id;
      if (!animTaskId) {
        throw new Error("No animation task ID received");
      }

      console.log(`🎬 Animation task created: ${animTaskId}`);
      const animatedOutput = await this.pollTask(animTaskId, options.maxWaitMs);

      if (animatedOutput.success && animatedOutput.model) {
        console.log("✅ Animation applied successfully!");
        return {
          ...animatedOutput,
          animated_model: animatedOutput.model,
          animation_type: animationType,
          success: true
        };
      }

      return { ...animatedOutput, success: true };
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.data) {
        console.error("🎬 Animation API error:", error.response.data);
      }
      throw new Error(`Animation failed: ${error.message}`);
    }
  }

  async downloadModel(url: string, outputPath: string) {
    const response = await axios.get(url, {
      responseType: "arraybuffer"
    });

    await fs.writeFile(outputPath, Buffer.from(response.data));
    return outputPath;
  }

  private async ensureLocalFile(source: string) {
    if (!source.startsWith("data:image/")) {
      return path.resolve(source);
    }

    const [metadata, base64Data] = source.split(",");
    if (!base64Data) {
      throw new Error("Invalid base64 image data");
    }

    const extension = metadata.includes("png")
      ? "png"
      : metadata.includes("webp")
      ? "webp"
      : "jpg";
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tripo-temp-"));
    const filePath = path.join(tempDir, `image-${randomUUID()}.${extension}`);
    await fs.writeFile(filePath, Buffer.from(base64Data, "base64"));
    return filePath;
  }
}

function getContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp"
  };
  return mimeTypes[ext] || "image/png";
}
