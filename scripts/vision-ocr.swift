#!/usr/bin/env swift

import AppKit
import Foundation
import Vision

enum OCRFailure: Error, LocalizedError {
	case usage
	case image(String)

	var errorDescription: String? {
		switch self {
		case .usage: return "Usage: vision-ocr.swift <image> <language-tag>"
		case .image(let path): return "Cannot read image: \(path)"
		}
	}
}

let arguments = CommandLine.arguments
guard arguments.count == 3 else { throw OCRFailure.usage }
let imagePath = arguments[1]
let language = arguments[2]
guard let image = NSImage(contentsOfFile: imagePath), let tiff = image.tiffRepresentation,
	let bitmap = NSBitmapImageRep(data: tiff), let cgImage = bitmap.cgImage else {
	throw OCRFailure.image(imagePath)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = [language]
request.usesLanguageCorrection = true
request.minimumTextHeight = 0.012

let handler = VNImageRequestHandler(cgImage: cgImage)
try handler.perform([request])

let observations = (request.results ?? []).compactMap { observation -> (String, CGRect)? in
	guard let candidate = observation.topCandidates(1).first else { return nil }
	return (candidate.string, observation.boundingBox)
}.sorted { lhs, rhs in
	let verticalGap = abs(lhs.1.midY - rhs.1.midY)
	if verticalGap > 0.012 { return lhs.1.midY > rhs.1.midY }
	return lhs.1.minX < rhs.1.minX
}

for (text, _) in observations { print(text) }
