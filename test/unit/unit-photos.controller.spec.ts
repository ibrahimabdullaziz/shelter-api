import { expect } from "chai";
import { afterEach, describe, it } from "mocha";
import sinon from "sinon";
import express from "express";
import requestHttp from "supertest";
import type { NextFunction, Request, Response } from "express";
import upload from "../../src/common/middleware/upload";
import { unitPhotoServices } from "../../src/modules/unit-photos/unit-photos.service";
import {
  deleteUnitPhoto,
  uploadUnitPhoto,
} from "../../src/modules/unit-photos/unit-photos.controller";

type FakeFile = { buffer: Buffer; mimetype: string };

function response() {
  const result = {
    status: sinon.stub(),
    json: sinon.stub(),
  } as unknown as Response;
  (result.status as sinon.SinonStub).returns(result);
  return result;
}

function request(
  params: Record<string, string> = {},
  user = { id: "host-1", role: "HOST" },
  file?: FakeFile,
) {
  return { params, user, file } as unknown as Request;
}

function next() {
  return sinon.stub() as unknown as NextFunction;
}

function flush() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

function body(result: Response) {
  return (result.json as sinon.SinonStub).firstCall.args[0];
}

describe("unit photo controller", () => {
  afterEach(() => sinon.restore());

  it("accepts a photo with multipart metadata", async () => {
    const app = express();
    app.post("/photos", upload.single("photo"), (req, res) => {
      res.status(200).json({
        hasPhoto: Boolean(req.file),
        caption: req.body.caption,
      });
    });

    const result = await requestHttp(app)
      .post("/photos")
      .field("caption", "Living room")
      .attach("photo", Buffer.from([0xff, 0xd8, 0xff]), {
        filename: "living-room.jpg",
        contentType: "image/jpeg",
      });

    expect(result.status).to.equal(200);
    expect(result.body).to.deep.equal({
      hasPhoto: true,
      caption: "Living room",
    });
  });

  it("uploads a photo for the authenticated host", async () => {
    const photo = { id: "photo-1", url: "https://example.com/photo.jpg" };
    const service = sinon
      .stub(unitPhotoServices, "uploadUnitPhotoService")
      .resolves(photo as never);
    const result = response();
    const file = {
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      mimetype: "image/jpeg",
    };

    uploadUnitPhoto(
      request({ unitId: "unit-1" }, undefined, file),
      result,
      next(),
    );
    await flush();

    expect(service.calledWith("unit-1", "host-1", file.buffer)).to.equal(true);
    expect(body(result)).to.deep.equal({
      status: 201,
      message: "photo uploaded successfully",
      data: photo,
    });
  });

  it("deletes a photo for the authenticated host", async () => {
    const service = sinon
      .stub(unitPhotoServices, "deleteUnitPhotoService")
      .resolves(undefined);
    const result = response();

    deleteUnitPhoto(request({ photoId: "photo-1" }), result, next());
    await flush();

    expect(service.calledWith("photo-1", "host-1")).to.equal(true);
    expect(body(result)).to.deep.equal({
      status: 200,
      message: "photo deleted successfully",
    });
  });

  it("forwards missing upload data to next", async () => {
    const errorNext = sinon.stub();

    uploadUnitPhoto(request(), response(), errorNext);
    await flush();

    expect(errorNext.calledOnce).to.equal(true);
    expect(errorNext.firstCall.args[0]).to.have.property("statusCode", 400);
  });

  it("rejects a file whose content is not an image", async () => {
    const errorNext = sinon.stub();

    uploadUnitPhoto(
      request({ unitId: "unit-1" }, undefined, {
        buffer: Buffer.from("not-an-image"),
        mimetype: "image/jpeg",
      }),
      response(),
      errorNext,
    );
    await flush();

    expect(errorNext.calledOnce).to.equal(true);
    expect(errorNext.firstCall.args[0]).to.have.property("statusCode", 400);
  });

  it("forwards photo service errors to next", async () => {
    const error = new Error("photo failed");
    const errorNext = sinon.stub();
    sinon.stub(unitPhotoServices, "deleteUnitPhotoService").rejects(error);

    deleteUnitPhoto(request({ photoId: "photo-1" }), response(), errorNext);
    await flush();

    expect(errorNext.calledOnceWithExactly(error)).to.equal(true);
  });
});
