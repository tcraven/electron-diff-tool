import React, { Component } from 'react';
import fs from 'fs-extra';
import electron from 'electron';
const jsdiff = require('diff');
const escapeHtml = require('escape-html');


const Menu = (props) => {
  return (
    <div className="menu">
      {props.comparisons.map((comparison, comparisonIndex) => {
        return (
          <div key={comparisonIndex} className="menu-comparison">
            {comparison.docA.filename}{' <=> '}{comparison.docB.filename}
          </div>
        );
      })}
    </div>
  );
};


const LineNumbers = (props) => {
  let lineNumbers = [];
  for (let i = 1; i <= props.count; i++) {
    lineNumbers.push(i);
  }
  return (
    <div className="line-numbers">
      <pre>{lineNumbers.join('\n')}</pre>
    </div>
  );
};


const DocHtml = (props) => {
  return (
    <div
      className="doc-html"
      dangerouslySetInnerHTML={{ __html: props.html }}
    />
  );
};


const Doc = (props) => {
  if (props.doc.error) {
    return (
      <div className={`doc ${props.className}`}>
        <div>{props.doc.error.toString()}</div>
      </div>
    );
  }
  return (
    <div className={`doc ${props.className}`}>
      <LineNumbers count={props.doc.lineCount} />
      <DocHtml html={props.doc.changesHtml} />
    </div>
  );
};


const Middle = (props) => {
  return (
    <div className="middle"></div>
  );
};


class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      comparisons: []
    };
  }

  componentDidMount() {
    this.load();
  }

  getHtml(text) {
    let lines = text.split('\n');
    return lines.map((line) => {
      let htmlWords = line.split(' ').map((word) => {
        return escapeHtml(word);
      });
      return htmlWords.join('&nbsp;');
    }).join('<br/>');
  }

  async load() {

    let args = electron.remote.process.argv;
    console.log('QQQ', args);
    let filenameA = args[2];
    let filenameB = args[3];
    console.log('QQQ', filenameA, filenameB);

    let comparisons = this.state.comparisons;

    comparisons.push({
      docA: {
        filename: filenameA,
        text: '',
        lines: [],
        lineCount: 0,
        error: null
      },
      docB: {
        filename: filenameB,
        text: '',
        lines: [],
        lineCount: 0,
        error: null
      }
    });

    for (let comparison of comparisons) {
      for (let docName of ['docA', 'docB']) {
        try {
          let filename = comparison[docName].filename;
          // console.log('XXX', filename);
          let text = await fs.readFile(filename, 'utf-8');
          comparison[docName].text = text;
          let lines = text.split('\n');
          comparison[docName].lines = lines;
          comparison[docName].lineCount = lines.length;
          // console.log('XXX', lines.length);
        }
        catch (error) {
          comparison[docName].error = error;
        }
      }

      let diffs = jsdiff.diffLines(comparison.docA.text, comparison.docB.text);
      let prevChange = null;
      let newDiffs = [];

      // Replace consecutive removed then added changes with a modified change
      let wasPrevModified = false;
      let i = 1;
      while (i < diffs.length) {
        // console.log('ZZZ', i, wasPrevModified);
        let prevChange = diffs[i - 1];
        let change = diffs[i];
        let isFinalChange = (i == diffs.length - 1);

        // console.log('ZZZ', i, prevChange, change, isFinalChange);

        if (prevChange.removed && change.added) {
          // console.log('ZZZ', i, 'modified', i - 1, i);
          newDiffs.push({
            modified: true,
            removedChange: prevChange,
            addedChange: change,
            charDiffs: jsdiff.diffWords(prevChange.value, change.value)
          });
          wasPrevModified = true;
          i += 1;
          continue;
        }
        
        if (!wasPrevModified) {
          // console.log('ZZZ', i,  'adding prev change', i - 1);
          newDiffs.push(prevChange);
        }
        if (isFinalChange) {
          // console.log('ZZZ', i, 'adding final change', i);
          newDiffs.push(change);
        }
        i += 1;
        wasPrevModified = false;
      }
      comparison.diffsOriginal = diffs;
      comparison.diffs = newDiffs;

      let chunksA = [];
      let chunksB = [];
      for (let change of comparison.diffs) {
        if (change.modified) {
          // chunksA.push('<span class="doc-modified">');
          // chunksA.push(this.getHtml(change.removedChange.value));
          // chunksA.push('</span>');
          // chunksB.push('<span class="doc-modified">');
          // chunksB.push(this.getHtml(change.addedChange.value));
          // chunksB.push('</span>');

          chunksA.push('<span class="doc-modified">');
          chunksB.push('<span class="doc-modified">');
          for (let charChange of change.charDiffs) {
            if (charChange.removed) {
              chunksA.push('<span class="doc-modified-removed">');
              chunksA.push(this.getHtml(charChange.value));
              chunksA.push('</span>');
            }
            else if (charChange.added) {
              chunksB.push('<span class="doc-modified-added">');
              chunksB.push(this.getHtml(charChange.value));
              chunksB.push('</span>');
            }
            else {
              chunksA.push(this.getHtml(charChange.value));
              chunksB.push(this.getHtml(charChange.value));
            }
          }
          chunksA.push('</span>');
          chunksB.push('</span>');
        }
        else if (change.removed) {
          chunksA.push('<span class="doc-removed">');
          chunksA.push(this.getHtml(change.value));
          chunksA.push('</span>');
        }
        else if (change.added) {
          chunksB.push('<span class="doc-added">');
          chunksB.push(this.getHtml(change.value));
          chunksB.push('</span>');
        }
        else {
          chunksA.push(this.getHtml(change.value));
          chunksB.push(this.getHtml(change.value));
        }
      }
      comparison.docA.changesHtml = chunksA.join('');
      comparison.docB.changesHtml = chunksB.join('');
    }

    console.log('XXX', comparisons);

    this.setState({
      comparisons: comparisons
    });
  }

  render() {
    let comparison = this.state.comparisons[0];
    if (!comparison) {
      return null;
    }
    return (
      <div className="app">
        <Menu comparisons={this.state.comparisons} />
        <Doc className="doc-a" doc={comparison.docA} />
        <Middle />
        <Doc className="doc-b" doc={comparison.docB} />
      </div>
    );
  }

}


export { App };
