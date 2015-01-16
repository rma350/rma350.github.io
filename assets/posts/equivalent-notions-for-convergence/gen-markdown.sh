#!/bin/bash

pandoc -s rec10.tex --bibliography bibliography.bib --to markdown_mmd -o pandoced.markdown \
&& tail -n +10 pandoced.markdown > noHead.markdown \
&& cat frontmatter.markdown noHead.markdown > 2013-02-13-equivalent-definitions-of-convergence-in-distribution-and-equality-in-distribution.markdown