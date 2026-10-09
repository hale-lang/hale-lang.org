// One real session on the demo application `hale dna new` makes, with the
// editor on scripted models; a hosted model gives the same commands and the
// same record. Shown on the homepage and on /dna.
export const session = `$ hale dna init .            # the organization, generated next to your code; the app untouched
$ hale dna dev               # the organization and the application on this machine
$ hale dna ask document the chat server in main.hl
task t1 born for intent i1a08c0786c5 [pending]

$ hale dna review m1
review m1 [pending]: apply m1 (docs): document the chat server in main.hl?
  needs leader · candidate bf94e503c1c002f277248b14b6afd1910bb8ce6f

source diff (git 232dc8f18dde .. bf94e503c1c0):
  +// documented by the organism: Echo answers every Ping

semantic diff (hale model diff, baseline .. candidate):
  classification: source-only  ·  no semantic differences

evidence (fmt=0 check=0 verify=0 test=0 diff=0 rollback=0 fleet=0):
  check      yes    0 e3b0c44298fc
  test       yes    0 184a3407ce31
  fleet      yes    0 b33b2e832b21
  rollback   yes    0 89978376be81

$ hale dna review m1 approve --as riley --comment "fine"
review m1 settled: approve by riley
hale dna dev: expression restarted (pid 1875137) as 3c9b9327e480d349 build 7a489ad3e72c
hale dna dev: m1 observed healthy for 5s as 3c9b9327e480d349`;
