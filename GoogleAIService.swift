import Foundation

class GoogleAIService {
    private let apiKey: String
    private let baseURL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
    
    init(apiKey: String) {
        self.apiKey = apiKey
    }
    
    func transcribeAudio(audioURL: URL, prompt: String) async throws -> String {
        // Convert audio to base64
        let audioData = try Data(contentsOf: audioURL)
        let base64Audio = audioData.base64EncodedString()
        
        // Prepare request
        var request = URLRequest(url: URL(string: "\(baseURL)?key=\(apiKey)")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Prepare request body
        let requestBody: [String: Any] = [
            "contents": [
                [
                    "parts": [
                        ["text": prompt],
                        ["inlineData": [
                            "mimeType": "audio/m4a",
                            "data": base64Audio
                        ]]
                    ]
                ]
            ]
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        // Make request
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(GoogleAIResponse.self, from: data)
        
        // Extract and return the transcribed text
        return response.candidates.first?.content.parts.first?.text ?? ""
    }
}

// Response models
struct GoogleAIResponse: Codable {
    let candidates: [Candidate]
}

struct Candidate: Codable {
    let content: Content
}

struct Content: Codable {
    let parts: [Part]
}

struct Part: Codable {
    let text: String
} 