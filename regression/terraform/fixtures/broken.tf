resource "aws_instance" "broken" {
  ami           = "invalid-ami"
  instance_type = "invalid-type"
  
  depends_on = [null_resource.nonexistent]
}
