// Host-side ExtendScript for the Marker Export CEP panel.
// Entry points called by the panel via evalScript:
//   chooseFolder()                            -> prompts for an export folder
//   choosePreset()                            -> prompts for a .epr (opens in AME Presets)
//   exportMarkersAsClips(folderPath, preset)  -> does the export with those paths
// Uses marker duration if present; otherwise marker-to-next-marker.

// Find the newest "Adobe Media Encoder/<version>/Presets" folder, if any.
function amePresetsDir() {
    var base = new Folder(Folder.myDocuments.fsName + "/Adobe/Adobe Media Encoder");
    if (!base.exists) return null;

    var entries = base.getFiles();
    var best = null;
    var bestVer = -1;

    for (var i = 0; i < entries.length; i++) {
        if (entries[i] instanceof Folder) {
            var ver = parseFloat(entries[i].name);
            var presets = new Folder(entries[i].fsName + "/Presets");
            if (presets.exists && !isNaN(ver) && ver > bestVer) {
                bestVer = ver;
                best = presets;
            }
        }
    }
    return best;
}

function chooseFolder() {
    var outputFolder = Folder.selectDialog("Choose export folder");
    if (!outputFolder) return "CANCELLED";
    return "OK\t" + outputFolder.fsName;
}

function choosePreset() {
    var startDir = amePresetsDir();
    var chosen;

    if (startDir) {
        // An instance openDlg opens the dialog in the file/folder's location,
        // so the user's saved AME presets are right there.
        chosen = (new File(startDir.fsName + "/")).openDlg(
            "Choose Adobe Media Encoder preset (.epr)", "*.epr", false);
    } else {
        chosen = File.openDialog("Choose Adobe Media Encoder preset (.epr)", "*.epr");
    }

    if (!chosen) return "CANCELLED";
    return "OK\t" + chosen.fsName;
}

function validateExportOptions(folderPath, presetPath) {
    if (!folderPath || !presetPath) {
        return { error: "ERROR: Set both an export folder and a preset first." };
    }

    var presetFile = new File(presetPath);
    if (!presetFile.exists) {
        return { error: "ERROR: Preset file not found:\n" + presetPath };
    }
    var outFolder = new Folder(folderPath);
    if (!outFolder.exists) {
        return { error: "ERROR: Export folder not found:\n" + folderPath };
    }

    return { presetFile: presetFile, outFolder: outFolder };
}

function safeExportName(name) {
    if (!name || name === "") name = "clip";
    return name
        .replace(/[\/\\:*?"<>|]/g, "_")
        .replace(/\s+/g, " ")
        .replace(/^\s+|\s+$/g, "");
}

function padExportNumber(num, size) {
    var s = String(num);
    while (s.length < size) s = "0" + s;
    return s;
}

function queueRanges(seq, ranges, folderPath, presetPath, description) {
    var options = validateExportOptions(folderPath, presetPath);
    if (options.error) return options.error;

    var ext = seq.getExportFileExtension(options.presetFile.fsName);
    if (!ext || ext === "") ext = "mp4";

    app.encoder.launchEncoder();

    var queued = 0;
    for (var i = 0; i < ranges.length; i++) {
        var range = ranges[i];
        if (range.end <= range.start) continue;

        seq.setInPoint(range.start);
        seq.setOutPoint(range.end);

        var filename = padExportNumber(i + 1, 3) + "_" +
            safeExportName(range.name) + "." + ext;
        var outputPath = options.outFolder.fsName + "/" + filename;

        // 1 = ENCODE_IN_TO_OUT
        // 1 = remove job from AME queue after completion
        var jobID = app.encoder.encodeSequence(
            seq,
            outputPath,
            options.presetFile.fsName,
            1,
            1
        );

        if (jobID && jobID !== "0") queued++;
    }

    if (queued > 0) {
        app.encoder.startBatch();
        return "Queued " + queued + " " + description + " export(s) in Adobe Media Encoder.";
    }
    return "ERROR: No valid " + description + " ranges found.";
}

function exportMarkersAsClips(folderPath, presetPath) {
    var seq = app.project.activeSequence;
    if (!seq) {
        return "ERROR: No active sequence open.";
    }

    var markers = seq.markers;
    if (!markers || markers.numMarkers === 0) {
        return "ERROR: No sequence markers found.";
    }

    function getMarkerArray() {
        var arr = [];
        var marker = markers.getFirstMarker();
        while (marker) {
            arr.push(marker);
            marker = markers.getNextMarker(marker);
        }
        return arr;
    }

    function markerHasDuration(marker) {
        return marker.end.seconds > marker.start.seconds;
    }

    var markerArray = getMarkerArray();
    var ranges = [];

    for (var i = 0; i < markerArray.length; i++) {
        var marker = markerArray[i];
        var inSeconds = marker.start.seconds;
        var outSeconds;

        if (markerHasDuration(marker)) {
            outSeconds = marker.end.seconds;
        } else if (i < markerArray.length - 1) {
            outSeconds = markerArray[i + 1].start.seconds;
        } else {
            // Last plain marker has no next marker, so skip it.
            continue;
        }

        ranges.push({
            start: inSeconds,
            end: outSeconds,
            name: marker.name || marker.comments || "marker"
        });
    }

    return queueRanges(seq, ranges, folderPath, presetPath, "marker");
}

function exportTimelineClips(folderPath, presetPath) {
    var seq = app.project.activeSequence;
    if (!seq) {
        return "ERROR: No active sequence open.";
    }

    var ranges = [];
    for (var trackIndex = 0; trackIndex < seq.videoTracks.numTracks; trackIndex++) {
        var track = seq.videoTracks[trackIndex];
        for (var clipIndex = 0; clipIndex < track.clips.numItems; clipIndex++) {
            var clip = track.clips[clipIndex];
            ranges.push({
                start: clip.start.seconds,
                end: clip.end.seconds,
                name: "V" + (trackIndex + 1) + "_" + (clip.name || "clip"),
                trackIndex: trackIndex,
                clipIndex: clipIndex
            });
        }
    }

    if (ranges.length === 0) {
        return "ERROR: No video clips found in the active sequence.";
    }

    // A sequence can have clips on multiple tracks; make filename numbering
    // predictable by exporting chronologically, then from lower to higher tracks.
    ranges.sort(function (a, b) {
        if (a.start !== b.start) return a.start - b.start;
        if (a.trackIndex !== b.trackIndex) return a.trackIndex - b.trackIndex;
        return a.clipIndex - b.clipIndex;
    });

    return queueRanges(seq, ranges, folderPath, presetPath, "timeline clip");
}
