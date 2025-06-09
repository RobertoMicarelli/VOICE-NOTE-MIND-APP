import Foundation
import SwiftUI

class MarkdownManager {
    static let shared = MarkdownManager()
    
    private init() {}
    
    func saveMarkdownFile(content: String, fileName: String) throws -> URL {
        let documentPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let fileURL = documentPath.appendingPathComponent("\(fileName).md")
        
        try content.write(to: fileURL, atomically: true, encoding: .utf8)
        return fileURL
    }
    
    func shareMarkdownFile(url: URL) {
        let activityVC = UIActivityViewController(
            activityItems: [url],
            applicationActivities: nil
        )
        
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first,
           let rootVC = window.rootViewController {
            rootVC.present(activityVC, animated: true)
        }
    }
    
    func readMarkdownFile(url: URL) throws -> String {
        return try String(contentsOf: url, encoding: .utf8)
    }
} 