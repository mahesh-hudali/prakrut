from xlit_translit import Model

model = Model(
    beam=5,
    nbest=5
)

result = model.translate_word(
    "naanu",
    "kn",
    rescore=False
)

print("Candidates:")
for i, candidate in enumerate(result or [], start=1):
    print(f"  {i}. {candidate}")
