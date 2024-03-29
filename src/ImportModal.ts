import { App, Modal, normalizePath } from "obsidian";
import * as os from "os";
import PluginSettings from "./TolinoNoteImportPluginSettings";
import NoteParser from "./NoteParser";
import TolinoNoteModel from "./TolinoNoteModel";
import { checkAndCreateFolder } from "./FileUtils";
import * as _path from "path";
import * as fs from 'fs';

export default class ImportModal extends Modal {
	tolinoPath: string;
	notesPath: string;
	noteTags: string
	settings: PluginSettings;
	noteParser: NoteParser;

	constructor(app: App, settings: PluginSettings) {
		super(app);
		this.settings = settings;
		console.log("Parsing notes now...")
		this.tolinoPath = this.settings.tolinoDriveSetting;
		this.notesPath = this.settings.notesPathSetting;
		this.noteTags = this.settings.tagsSetting;
	}

	onOpen() {
		const file = this.readFile(this.tolinoPath);
		const tolinoNotes = NoteParser.parseNoteFile(file);
		// create a new array containing one element for each book
		const uniqueBooks = this.removeDuplicates(tolinoNotes);
		// create new notes in vault
		uniqueBooks.forEach(async (note) => {
			// create book files
			this.writeFile(note.bookName, note.noteText);
		});
		const { contentEl } = this;
		contentEl.setText('Tolino Notes loaded!');
	}

	removeDuplicates(notes: TolinoNoteModel[]): TolinoNoteModel[] {
		const uniqueTitles = new Set();
		const uniqueBooks: TolinoNoteModel[] = [];
		const currentDate = new Date().toISOString().split('T')[0];
		
		notes.forEach((note) => {
			// Ensure bookName is defined
			if (!note.bookName) {
				console.error('Undefined bookName for note:', note);
				return; // Skip this note
			}
		
			if (!uniqueTitles.has(note.bookName)) {
				uniqueTitles.add(note.bookName);
				const newNote = new TolinoNoteModel();
				newNote.bookName = note.bookName;
		
				// Attempt to extract title and author
				const titleMatch = note.bookName.match(/^(.*?)\s\((.*?),\s(.*?)\)$/);
				let title = "Unknown Title";
				let author = "Unknown Author";
				if (titleMatch && titleMatch.length >= 4) {
					title = titleMatch[1];
					author = `${titleMatch[3]} ${titleMatch[2]}`; // Formatting as "First Name Last Name"
				}
		
				// Remove # from this.noteTags and save to a new variable
				const cleanedTags = this.noteTags.replace(/#/g, '').split(',').join(', ');
		
				// Format the note text to include the front matter
				newNote.noteText = `---${os.EOL}`;
				newNote.noteText += `Created: ${currentDate}${os.EOL}`;
				newNote.noteText += `Type: Tolino${os.EOL}`;
				newNote.noteText += `Title: ${title}${os.EOL}`; // Include extracted title
				newNote.noteText += `Author: ${author}${os.EOL}`; // Include extracted author
				// Use cleanedTags instead of this.noteTags
				newNote.noteText += `Tags: ${cleanedTags}${os.EOL}`;
				newNote.noteText += `---${os.EOL}${os.EOL}`;
				newNote.noteText += "Tags: " + this.noteTags + os.EOL + os.EOL;
				newNote.noteText += `**Page ${note.page}**, Created on ${note.date} ${note.time}${os.EOL}${note.noteText}${os.EOL}---${os.EOL}`;
		
				uniqueBooks.push(newNote);
			} else {
				const bookNote = uniqueBooks.find(existingNote => existingNote.bookName === note.bookName);
				if (bookNote) {
					// Append additional note text for the same book
					bookNote.noteText += `**Page ${note.page}**, Created on ${note.date} ${note.time}${os.EOL}${note.noteText}${os.EOL}---${os.EOL}`;
				}
			}
		});
		return uniqueBooks;
	}
		  	  
	async writeFile(bookName: string, content: string): Promise<void> {
		let fileName: string;
		let filePath: string;
	  
		// Extract the title and author from the bookName
		// Assuming bookName is "Title (Last Name, First Name)"
		const titleMatch = bookName.match(/^(.*?)\s\((.*?),\s(.*?)\)$/);
		if (titleMatch) {
			const title = titleMatch[1];
			const lastName = titleMatch[2];
			const firstName = titleMatch[3];
			// Reformat fileName to "Title - First Name Last Name.md"
			fileName = `${title} - ${firstName} ${lastName}.md`;
		} else {
			// Fallback if the regex match fails
			fileName = `${bookName}.md`;
		}
	  
		// Normalize fileName to replace any characters that might be invalid in a file path
		fileName = normalizePath(fileName).replace(/[/\\?%*:|"<>]/g, '-');
	  
		await checkAndCreateFolder(this.app.vault, this.notesPath);
	  
		if (this.notesPath) {
			filePath = normalizePath(_path.join(this.notesPath, fileName));
		} else {
			filePath = normalizePath(_path.join(this.app.vault.getRoot().path, fileName));
		}
		console.info("Writing file: " + filePath);
		await this.app.vault.adapter.write(filePath, content);
	}
	
	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	//method to read a file from a provides path using NoteParser
	readFile(path: string) {
		console.info(path)
		let osPathString = '';
		//check if path is a valid path
		osPathString = _path.join(path, 'notes.txt');
		const file = fs.readFileSync(osPathString, 'utf8')
		//replace unicode character U+00a0 with a space
		return file.replace(/\u00a0/g, ' ');
	}
}
