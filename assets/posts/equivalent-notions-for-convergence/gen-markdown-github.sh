#!/bin/bash

pandoc -s rec10.tex --bibliography bibliography.bib --to markdown_github -o pandoced.markdown \
&& tail -n +6 pandoced.markdown > noHead.markdown \
&& cat frontmatter.markdown noHead.markdown > wholeFile.markdown \
&& sed 's/{\\mathbb I}/\\mathbb I/g' wholeFile.markdown > noI.markdown \
&& sed 's/{\\mathbb E}/\\mathbb E/g' noI.markdown > noIE.markdown \
&& sed 's/{\\mathop{\\text{\\rm BL}}}/\\mathop{\\text{\\rm BL}}/g' noIE.markdown > compilesOk.markdown \
&& sed 's/\\begin{aligned}/\\begin{align}/g' compilesOk.markdown > fixMath1.markdown \
&& sed 's/\\end{aligned}/\\end{align}/g' fixMath1.markdown > fixMath2.markdown \
&& sed 's/\\\[/$$/g' fixMath2.markdown > fixMath3.markdown \
&& sed 's/\\\]/$$/g' fixMath3.markdown > fixMath4.markdown \
&& sed 's/\\(/\\\\(/g' fixMath4.markdown > fixMath5.markdown \
&& sed 's/\\)/\\\\)/g' fixMath5.markdown > 2013-02-13-equivalent-definitions-of-convergence-in-distribution-and-equality-in-distribution.markdown \
