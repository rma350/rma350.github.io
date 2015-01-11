---
layout: post
title:  "Labeling Commutative Diagrams with Hyperlinks in LaTeX"
date:   2011-05-23 15:26:00
---

In the example below, a commutative diagram was drawn using Tikz.  The arrows in the diagram have labels that link to the corresponding theorem below.

<iframe src="../../../assets/posts/commutativeDiagramLinkedLabels/interchangetikz.pdf" style="width:600px; height:500px;" frameborder="0"></iframe>

You can download this example [here](../../../assets/posts/commutativeDiagramLinkedLabels/interchangetikz.pdf).  The LaTeX code used to generate this figure is below.

{% highlight latex %}
\documentclass{article}
\pagestyle{empty}
\usepackage{tikz,amsmath}
\usetikzlibrary{arrows,shapes,matrix}
\newtheorem{thm}{Theorem}
\usepackage{hyperref}
\hypersetup{
  colorlinks=true,
}
\begin{document}
\begin{figure}
  \centering
  \begin{tikzpicture}
    \matrix(m)[matrix of math nodes, row sep=10em, column sep=10em]
    {Q^n(t)&Q^n(\infty)\\
      q(t)&q(\infty)\\};
    \path[->]
    (m-1-1) edge node[above]{
      \hyperref[thm:stability]{Theorem \ref{thm:stability}}}
    node[below] {$t \to \infty$} (m-1-2)
    (m-1-1) edge node[left]{
      \hyperref[thm:convergence]{Theorem \ref{thm:convergence}}}
    node[right] {$\displaystyle \lim_{n \to \infty} \frac{Q^n(t)}{n}$}
    (m-2-1)
    (m-2-1) edge node[above]{
      \hyperref[thm:fixedPoint]{Theorem \ref{thm:fixedPoint}}}
    node[below] {$t \to \infty$} (m-2-2)
    (m-1-2) edge node[left]{
      \hyperref[thm:interchange]{Theorem \ref{thm:interchange}}}
    node[right] {
      $\displaystyle \lim_{n \to \infty} \frac{Q^n(\infty)}{n}$}
    (m-2-2)
    ;    
  \end{tikzpicture}
\end{figure}
\newpage
\begin{thm}
  \label{thm:stability}
  When $\rho < 1$, for all $n$, $Q^n(t) \Rightarrow Q^n(\infty)$ as
  $t \to \infty$.
\end{thm}
\newpage
\begin{thm}
  \label{thm:convergence}
  For any $q(0)$, when $Q^n(0)/n \to q(0)$ almost surely as $n \to
  \infty$, then $Q^n(t)/n \to q(t)$ almost surely and uniformly on
  compact sets $[0,T]$.
\end{thm}
\newpage
\begin{thm}
  \label{thm:fixedPoint}
  As $t \to \infty$, $q(t) \to q(\infty)$ for all $q(0)$.
\end{thm}
\newpage
\begin{thm}
  \label{thm:interchange}
  As $n \to \infty$, $Q^n(\infty)/n \to q(\infty)$ in probability.
\end{thm}
\end{document}
{% endhighlight %}