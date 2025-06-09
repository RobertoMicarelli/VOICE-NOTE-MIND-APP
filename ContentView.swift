import SwiftUI
import AVFoundation

struct ContentView: View {
    @StateObject private var audioRecorder = AudioRecorder()
    @State private var isRecording = false
    @State private var showingSaveDialog = false
    @State private var savedRecordings: [Recording] = []
    
    var body: some View {
        NavigationView {
            VStack {
                // Header
                Text("Voice Notes")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .padding()
                
                // Recording Button
                Button(action: {
                    if isRecording {
                        audioRecorder.stopRecording()
                    } else {
                        audioRecorder.startRecording()
                    }
                    isRecording.toggle()
                }) {
                    ZStack {
                        Circle()
                            .fill(isRecording ? Color.red : Color.blue)
                            .frame(width: 80, height: 80)
                        
                        if isRecording {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color.white)
                                .frame(width: 30, height: 30)
                        } else {
                            Circle()
                                .fill(Color.white)
                                .frame(width: 30, height: 30)
                        }
                    }
                }
                .padding()
                
                // Recording Status
                Text(isRecording ? "Recording..." : "Tap to Record")
                    .foregroundColor(isRecording ? .red : .gray)
                
                // List of Saved Recordings
                List(savedRecordings) { recording in
                    RecordingRow(recording: recording)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct RecordingRow: View {
    let recording: Recording
    
    var body: some View {
        HStack {
            Image(systemName: "waveform")
                .foregroundColor(.blue)
            Text(recording.name)
            Spacer()
            Text(recording.date, style: .date)
                .foregroundColor(.gray)
        }
    }
}

struct Recording: Identifiable {
    let id = UUID()
    let name: String
    let date: Date
    let url: URL
}

class AudioRecorder: ObservableObject {
    private var audioRecorder: AVAudioRecorder?
    
    func startRecording() {
        let recordingSession = AVAudioSession.sharedInstance()
        
        do {
            try recordingSession.setCategory(.playAndRecord, mode: .default)
            try recordingSession.setActive(true)
            
            let documentPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let audioFilename = documentPath.appendingPathComponent("\(Date().timeIntervalSince1970).m4a")
            
            let settings = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 44100,
                AVNumberOfChannelsKey: 2,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
            ]
            
            audioRecorder = try AVAudioRecorder(url: audioFilename, settings: settings)
            audioRecorder?.record()
        } catch {
            print("Could not start recording: \(error)")
        }
    }
    
    func stopRecording() {
        audioRecorder?.stop()
    }
} 